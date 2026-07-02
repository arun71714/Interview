"""Backend API tests for NNE Data Analyst assessment tool"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://multi-lang-test-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Sets & Questions ----------
class TestSets:
    def test_list_sets(self):
        r = requests.get(f"{API}/sets", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 2
        ids = {s["set_id"] for s in data}
        assert ids == {"A", "B"}
        by_id = {s["set_id"]: s for s in data}
        assert by_id["A"]["cutoff"] == 65 and by_id["A"]["strong"] == 75
        assert by_id["B"]["cutoff"] == 75 and by_id["B"]["strong"] == 85
        for s in data:
            assert s["question_count"] == 20
            assert s["duration_minutes"] == 30

    @pytest.mark.parametrize("set_id", ["A", "B"])
    def test_get_questions_no_rubric_leak(self, set_id):
        r = requests.get(f"{API}/sets/{set_id}/questions", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["set_id"] == set_id
        assert len(data["questions"]) == 20
        for q in data["questions"]:
            assert "rubric" not in q, f"Rubric leaked in {set_id} qid {q.get('qid')}"
            assert q["type"] in ("sql", "python", "dax", "text")
            assert "marks" in q
            assert "question" in q
            # 'context' key allowed to be None but present as key

    def test_invalid_set_404(self):
        r = requests.get(f"{API}/sets/Z/questions", timeout=30)
        assert r.status_code == 404


# ---------- Sessions ----------
class TestSessions:
    def test_create_and_get_session(self):
        payload = {"candidate_name": "TEST_Candidate", "email": "test@example.com", "set_id": "A"}
        r = requests.post(f"{API}/sessions", json=payload, timeout=30)
        assert r.status_code == 200
        s = r.json()
        assert s["candidate_name"] == "TEST_Candidate"
        assert s["set_id"] == "A"
        assert s["submitted"] is False
        assert "id" in s

        r2 = requests.get(f"{API}/sessions/{s['id']}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["id"] == s["id"]

    def test_invalid_set_rejected(self):
        r = requests.post(f"{API}/sessions",
                          json={"candidate_name": "X", "email": "x@y.com", "set_id": "Z"}, timeout=30)
        assert r.status_code == 400

    def test_empty_name_rejected(self):
        r = requests.post(f"{API}/sessions",
                          json={"candidate_name": "  ", "email": "x@y.com", "set_id": "A"}, timeout=30)
        assert r.status_code == 400

    def test_session_not_found(self):
        r = requests.get(f"{API}/sessions/nonexistent-id", timeout=30)
        assert r.status_code == 404


# ---------- SQL execution ----------
class TestSqlExecution:
    def test_sql_select_engineering_tag(self):
        r = requests.post(f"{API}/execute/sql", json={"sql": "SELECT * FROM EngineeringTag"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["row_count"] == 8
        assert set(data["columns"]) == {"tag_id", "tag_name", "discipline", "model_id"}

    def test_sql_bad_query(self):
        r = requests.post(f"{API}/execute/sql", json={"sql": "SELECT * FROM NoSuchTable"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "error" in data

    def test_sql_left_join_anti(self):
        # Q1 rubric expected result: LT-4001, PT-2002, TT-3002
        sql = ("SELECT e.tag_name FROM EngineeringTag e "
               "LEFT JOIN PI_TAGS p ON e.tag_name = p.pi_tag WHERE p.pi_tag IS NULL")
        r = requests.post(f"{API}/execute/sql", json={"sql": sql}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        names = {row[0] for row in data["rows"]}
        assert names == {"LT-4001", "PT-2002", "TT-3002"}

    def test_sql_empty(self):
        r = requests.post(f"{API}/execute/sql", json={"sql": "   "}, timeout=30)
        assert r.status_code == 400


# ---------- Python execution ----------
class TestPythonExecution:
    def test_python_pandas_shape(self):
        code = "import pandas as pd\nprint(pd.read_csv('tags.csv').shape)"
        r = requests.post(f"{API}/execute/python", json={"code": code}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True, f"stderr: {data.get('stderr')}"
        assert "(10, 6)" in data["stdout"]

    def test_python_blocked_subprocess(self):
        code = "import subprocess\nprint('x')"
        r = requests.post(f"{API}/execute/python", json={"code": code}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "restricted" in data["error"].lower()

    def test_python_timeout(self):
        code = "while True:\n    pass"
        r = requests.post(f"{API}/execute/python", json={"code": code}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is False
        assert "timed out" in data["error"].lower()

    def test_python_empty(self):
        r = requests.post(f"{API}/execute/python", json={"code": ""}, timeout=30)
        assert r.status_code == 400


# ---------- Submit / Grading (LLM heavy) ----------
class TestSubmitGrading:
    def test_submit_and_history(self):
        # Create session
        r = requests.post(f"{API}/sessions",
                          json={"candidate_name": "TEST_Submit", "email": "sub@test.com", "set_id": "A"},
                          timeout=30)
        assert r.status_code == 200
        sid = r.json()["id"]

        # Provide 2 correct-ish answers, others empty
        answers = [
            {"qid": 1,
             "answer": ("SELECT e.tag_name FROM EngineeringTag e "
                        "LEFT JOIN PI_TAGS p ON e.tag_name = p.pi_tag WHERE p.pi_tag IS NULL"),
             "execution_output": "LT-4001, PT-2002, TT-3002"},
            {"qid": 6,
             "answer": ("SELECT object_id, revision_no, revised_at, status FROM ("
                        "SELECT *, ROW_NUMBER() OVER (PARTITION BY object_id "
                        "ORDER BY revised_at DESC, revision_no DESC) rn FROM ObjectRevision) "
                        "WHERE rn = 1"),
             "execution_output": None},
        ]

        r = requests.post(f"{API}/sessions/{sid}/submit", json={"answers": answers}, timeout=240)
        assert r.status_code == 200, r.text
        result = r.json()
        assert result["session_id"] == sid
        assert result["max_marks"] == 100
        assert result["verdict"] in ("FAIL", "PASS", "STRONG SHORTLIST")
        assert len(result["per_question"]) == 20
        assert isinstance(result["total"], (int, float))
        # Verify per_question has feedback
        q1 = next(q for q in result["per_question"] if q["qid"] == 1)
        assert q1["score"] >= 3  # correct SQL should score well
        assert "feedback" in q1

        # Idempotent resubmit returns same result
        r2 = requests.post(f"{API}/sessions/{sid}/submit", json={"answers": []}, timeout=60)
        assert r2.status_code == 200
        assert r2.json()["id"] == result["id"]
        assert r2.json()["total"] == result["total"]

        # History without per_question
        r3 = requests.get(f"{API}/results", timeout=30)
        assert r3.status_code == 200
        hist = r3.json()
        assert isinstance(hist, list)
        assert any(h["session_id"] == sid for h in hist)
        for h in hist:
            assert "per_question" not in h

        # Full result by session
        r4 = requests.get(f"{API}/results/session/{sid}", timeout=30)
        assert r4.status_code == 200
        assert len(r4.json()["per_question"]) == 20

    def test_submit_nonexistent_session(self):
        r = requests.post(f"{API}/sessions/nonexistent/submit", json={"answers": []}, timeout=30)
        assert r.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
