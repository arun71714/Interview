from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
import bcrypt
import jwt
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import sys
import json
import uuid
import shutil
import sqlite3
import asyncio
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

from questions import QUESTION_SETS, SQLITE_SEED

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SANDBOX_DIR = ROOT_DIR / "sandbox"


# ---------- Models ----------
class SessionCreate(BaseModel):
    candidate_name: str
    email: str
    set_id: str


class AnswerIn(BaseModel):
    qid: int
    answer: str = ""
    execution_output: Optional[str] = None


class SubmitIn(BaseModel):
    answers: List[AnswerIn]


class SqlIn(BaseModel):
    sql: str


class PyIn(BaseModel):
    code: str


# ---------- Admin auth ----------
JWT_ALGORITHM = "HS256"


class LoginIn(BaseModel):
    email: str
    password: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(email: str) -> str:
    from datetime import timedelta
    payload = {"sub": email, "type": "access", "role": "admin",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth_header[7:], os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access" or payload.get("role") != "admin":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"email": payload["sub"], "role": "admin"}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


@app.on_event("startup")
async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"email": email, "password_hash": hash_password(password),
                                   "name": "Admin", "role": "admin",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


@api_router.post("/auth/login")
async def admin_login(inp: LoginIn):
    user = await db.users.find_one({"email": inp.email.strip().lower(), "role": "admin"})
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": create_access_token(user["email"]),
            "email": user["email"], "name": user["name"]}


@api_router.get("/auth/me")
async def auth_me(admin: dict = Depends(get_current_admin)):
    return admin


# ---------- Question endpoints ----------
@api_router.get("/sets")
async def list_sets():
    return [
        {"set_id": k, "title": v["title"], "cutoff": v["cutoff"], "strong": v["strong"],
         "duration_minutes": v["duration_minutes"], "question_count": len(v["questions"])}
        for k, v in QUESTION_SETS.items()
    ]


@api_router.get("/sets/{set_id}/questions")
async def get_questions(set_id: str):
    s = QUESTION_SETS.get(set_id)
    if not s:
        raise HTTPException(404, "Set not found")
    qs = [{k: q[k] for k in ("qid", "skill", "level", "marks", "type", "question")} | {"context": q.get("context")}
          for q in s["questions"]]
    return {"set_id": set_id, "title": s["title"], "cutoff": s["cutoff"], "strong": s["strong"],
            "duration_minutes": s["duration_minutes"], "questions": qs}


# ---------- Session endpoints ----------
@api_router.post("/sessions")
async def create_session(inp: SessionCreate):
    if inp.set_id not in QUESTION_SETS:
        raise HTTPException(400, "Invalid set")
    if not inp.candidate_name.strip():
        raise HTTPException(400, "Name required")
    doc = {
        "id": str(uuid.uuid4()),
        "candidate_name": inp.candidate_name.strip(),
        "email": inp.email.strip(),
        "set_id": inp.set_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "submitted": False,
    }
    await db.sessions.insert_one({**doc})
    return doc


@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Session not found")
    return doc


# ---------- Code execution ----------
def run_sql(sql: str):
    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(SQLITE_SEED)
        cur = conn.execute(sql)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = cur.fetchmany(200)
            return {"success": True, "columns": cols, "rows": [list(r) for r in rows],
                    "row_count": len(rows)}
        return {"success": True, "columns": [], "rows": [], "row_count": 0}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


@api_router.post("/execute/sql")
async def execute_sql(inp: SqlIn):
    if not inp.sql.strip():
        raise HTTPException(400, "Empty SQL")
    return await asyncio.to_thread(run_sql, inp.sql)


BLOCKED_PY = re.compile(r"\b(subprocess|shutil|socket|urllib|requests|os\.system|os\.popen|os\.remove|os\.rmdir|__import__)\b")


@api_router.post("/execute/python")
async def execute_python(inp: PyIn):
    if not inp.code.strip():
        raise HTTPException(400, "Empty code")
    if BLOCKED_PY.search(inp.code):
        return {"success": False, "error": "Use of restricted modules/functions is not allowed in this sandbox."}
    with tempfile.TemporaryDirectory() as td:
        shutil.copy(SANDBOX_DIR / "tags.csv", Path(td) / "tags.csv")
        (Path(td) / "code.py").write_text(inp.code)
        try:
            proc = await asyncio.create_subprocess_exec(
                sys.executable, "code.py", cwd=td,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            out, err = await asyncio.wait_for(proc.communicate(), timeout=15)
        except asyncio.TimeoutError:
            proc.kill()
            return {"success": False, "error": "Execution timed out (15s limit)."}
        stdout = out.decode()[:8000]
        stderr = err.decode()[:4000]
        return {"success": proc.returncode == 0, "stdout": stdout, "stderr": stderr}


# ---------- AI Grading ----------
GRADER_SYSTEM = (
    "You are a strict but fair senior technical examiner grading a Data Analyst assessment "
    "(SQL, Python/pandas, Power BI/DAX, data engineering concepts). For each question you receive: "
    "the question, an expected-answer rubric, the candidate's answer, and optionally the output of "
    "executing their code. Score each answer 0-5 (integers or .5 steps): 5=fully correct/complete, "
    "3-4=mostly correct with gaps, 1-2=partially relevant, 0=blank/wrong/off-topic. Empty or "
    "placeholder answers score 0. Give concise 1-2 sentence feedback per question. "
    "Respond ONLY with a JSON array: [{\"qid\": <int>, \"score\": <number>, \"feedback\": \"...\"}]"
)


async def grade_batch(set_id: str, batch: list, answers_by_qid: dict, session_id: str):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    parts = []
    for q in batch:
        a = answers_by_qid.get(q["qid"])
        ans = (a.answer if a else "").strip() or "(no answer)"
        exec_out = (a.execution_output if a and a.execution_output else None)
        parts.append(
            f"--- Question {q['qid']} ({q['skill']}, {q['marks']} marks) ---\n"
            f"Question: {q['question']}\n"
            f"Rubric: {q['rubric']}\n"
            f"Candidate answer:\n{ans[:4000]}\n"
            + (f"Execution output:\n{exec_out[:2000]}\n" if exec_out else "")
        )
    chat = LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"grade-{session_id}-{batch[0]['qid']}",
        system_message=GRADER_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-6")
    resp = await chat.send_message(UserMessage(text="\n".join(parts)))
    text = resp if isinstance(resp, str) else str(resp)
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON in grader response: {text[:200]}")
    return json.loads(m.group(0))


@api_router.post("/sessions/{session_id}/submit")
async def submit_session(session_id: str, inp: SubmitIn):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    existing = await db.results.find_one({"session_id": session_id}, {"_id": 0})
    if existing:
        return existing

    qset = QUESTION_SETS[session["set_id"]]
    questions = qset["questions"]
    answers_by_qid = {a.qid: a for a in inp.answers}

    batches = [questions[i:i + 5] for i in range(0, len(questions), 5)]
    graded = {}
    results = await asyncio.gather(
        *[grade_batch(session["set_id"], b, answers_by_qid, session_id) for b in batches],
        return_exceptions=True)
    for res, batch in zip(results, batches):
        if isinstance(res, Exception):
            logger.error(f"Grading batch failed: {res}")
            for q in batch:
                graded[q["qid"]] = {"score": 0, "feedback": "Grading failed for this question. Please regrade."}
        else:
            for item in res:
                graded[int(item["qid"])] = {"score": min(5, max(0, float(item["score"]))),
                                            "feedback": item.get("feedback", "")}

    per_question = []
    total = 0.0
    for q in questions:
        g = graded.get(q["qid"], {"score": 0, "feedback": "Not graded"})
        a = answers_by_qid.get(q["qid"])
        total += g["score"]
        per_question.append({
            "qid": q["qid"], "skill": q["skill"], "type": q["type"], "marks": q["marks"],
            "question": q["question"], "answer": (a.answer if a else ""),
            "execution_output": (a.execution_output if a else None),
            "score": g["score"], "feedback": g["feedback"],
        })

    verdict = "FAIL"
    if total >= qset["strong"]:
        verdict = "STRONG SHORTLIST"
    elif total >= qset["cutoff"]:
        verdict = "PASS"

    result = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "candidate_name": session["candidate_name"],
        "email": session["email"],
        "set_id": session["set_id"],
        "set_title": qset["title"],
        "started_at": session["started_at"],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "max_marks": 100,
        "cutoff": qset["cutoff"],
        "strong": qset["strong"],
        "verdict": verdict,
        "per_question": per_question,
    }
    await db.results.insert_one({**result})
    await db.sessions.update_one({"id": session_id}, {"$set": {"submitted": True}})
    return result


@api_router.get("/results")
async def list_results(admin: dict = Depends(get_current_admin)):
    docs = await db.results.find({}, {"_id": 0, "per_question": 0}).sort("submitted_at", -1).to_list(500)
    return docs


@api_router.get("/results/session/{session_id}")
async def get_result_by_session(session_id: str):
    doc = await db.results.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Result not found")
    return doc


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
