import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Play, Send, Loader2, Database, Code2, Braces, FileText, ChevronLeft, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TYPE_ICON = { sql: Database, python: Code2, dax: Braces, text: FileText };
const TYPE_LABEL = { sql: "SQL — executable", python: "Python — executable", dax: "DAX — AI graded", text: "Written answer — AI graded" };
const PLACEHOLDER = {
  sql: "-- Write your SQL here, then press Run",
  python: "# Write pandas code here, then press Run\nimport pandas as pd",
  dax: "// Write your DAX measure here (graded by AI)",
  text: "Write your answer here...",
};

function navButtonClass(isCurrent, isDone) {
  if (isCurrent) return "border-slate-950 ring-2 ring-slate-950 ring-offset-1";
  if (isDone) return "border-slate-950 bg-slate-950 text-white";
  return "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-950";
}

function editorClass(isCode) {
  if (isCode) return "code-editor";
  return "border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-950";
}

function formatSqlResult(data) {
  if (!data.success) return `SQL ERROR: ${data.error}`;
  if (!data.columns.length) return "Statement executed (no result set)";
  const header = data.columns.join(" | ");
  const rows = data.rows.map((row) => row.map((c) => (c === null ? "NULL" : c)).join(" | ")).join("\n");
  return `${header}\n${"-".repeat(header.length)}\n${rows}\n(${data.row_count} rows)`;
}

function formatPyResult(data) {
  if (data.error) return `ERROR: ${data.error}`;
  const out = `${data.stdout || ""}${data.stderr ? `\nSTDERR:\n${data.stderr}` : ""}`.trim();
  return out || "(no output)";
}

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-white">
    <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.5} />
  </div>
);

const GradingScreen = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
    <Loader2 className="h-10 w-10 animate-spin" strokeWidth={1.5} />
    <h2 className="mt-6 font-heading text-2xl font-bold tracking-tight">AI grading in progress</h2>
    <p className="mt-2 max-w-md text-center text-sm text-slate-600">
      Claude is evaluating all 20 answers against the official answer key. This takes 30–90 seconds.
    </p>
  </div>
);

const TestHeader = ({ setTitle, candidateName, secondsLeft, onSubmit }) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return (
    <header className="sticky top-0 z-50 border-b border-slate-950 bg-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{setTitle}</p>
          <p className="text-sm font-bold">{candidateName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div data-testid="test-timer" className={`font-mono text-2xl font-bold ${secondsLeft < 300 ? "text-red-500" : "text-slate-950"}`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <button
            data-testid="submit-test-button"
            onClick={onSubmit}
            className="flex items-center gap-2 bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all duration-150 hover:bg-slate-800"
          >
            <Send className="h-4 w-4" strokeWidth={1.5} /> Submit
          </button>
        </div>
      </div>
    </header>
  );
};

const SidebarNav = ({ questions, current, answers, onSelect }) => {
  const answered = questions.filter((q) => (answers[q.qid] || "").trim()).length;
  return (
    <aside className="border-b border-slate-200 p-4 md:w-56 md:border-b-0 md:border-r">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Questions — {answered}/20</p>
      <div className="mt-3 grid grid-cols-10 gap-1 md:grid-cols-5 md:gap-2">
        {questions.map((qq, i) => (
          <button
            key={qq.qid}
            data-testid={`question-nav-${qq.qid}`}
            onClick={() => onSelect(i)}
            className={`flex h-9 w-full items-center justify-center border text-xs font-bold transition-all duration-150 ${navButtonClass(i === current, (answers[qq.qid] || "").trim())}`}
          >
            {qq.qid}
          </button>
        ))}
      </div>
      <div className="mt-6 hidden space-y-2 font-mono text-xs text-slate-500 md:block">
        <p><span className="mr-2 inline-block h-3 w-3 border border-slate-950 bg-slate-950 align-middle" />answered</p>
        <p><span className="mr-2 inline-block h-3 w-3 border border-slate-200 bg-slate-100 align-middle" />pending</p>
      </div>
    </aside>
  );
};

const QuestionPanel = ({ q, current, onNav }) => {
  const Icon = TYPE_ICON[q.type];
  return (
    <section className="flex-1 border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{TYPE_LABEL[q.type]}</span>
        </div>
        <span className="font-mono text-xs text-slate-500">{q.marks} marks · {q.level}</span>
      </div>
      <h2 className="mt-4 font-heading text-xl font-bold tracking-tight">Q{q.qid}. {q.skill}</h2>
      <p data-testid="question-text" className="mt-3 text-base leading-relaxed text-slate-800">{q.question}</p>
      {q.context && (
        <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Environment</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-slate-700">{q.context}</p>
        </div>
      )}
      <div className="mt-8 flex gap-2">
        <button
          data-testid="prev-question-button"
          disabled={current === 0}
          onClick={() => onNav(current - 1)}
          className="flex items-center gap-1 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Prev
        </button>
        <button
          data-testid="next-question-button"
          disabled={current === 19}
          onClick={() => onNav(current + 1)}
          className="flex items-center gap-1 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white disabled:opacity-30"
        >
          Next <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </section>
  );
};

const AnswerPanel = ({ q, value, onChange, output, running, onRun }) => {
  const executable = q.type === "sql" || q.type === "python";
  const isCode = executable || q.type === "dax";
  return (
    <section className="flex flex-1 flex-col p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Your Answer</p>
        {executable && (
          <button
            data-testid="run-code-button"
            onClick={onRun}
            disabled={running}
            className="flex items-center gap-2 border border-slate-950 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Play className="h-4 w-4" strokeWidth={1.5} />}
            Run {q.type === "sql" ? "SQL" : "Python"}
          </button>
        )}
      </div>
      <textarea
        data-testid="answer-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={PLACEHOLDER[q.type]}
        className={`mt-3 min-h-[220px] w-full flex-1 p-4 text-sm leading-relaxed ${editorClass(isCode)}`}
      />
      {executable && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Output</p>
          <pre data-testid="execution-output" className="mt-2 max-h-52 min-h-[80px] overflow-auto border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
            {output || "Run your code to see output here."}
          </pre>
        </div>
      )}
    </section>
  );
};

export default function Test() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [setData, setSetData] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [outputs, setOutputs] = useState({});
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const submittedRef = useRef(false);
  const answersRef = useRef({});
  const outputsRef = useRef({});

  useEffect(() => {
    const saved = localStorage.getItem(`answers-${sessionId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setAnswers(parsed.answers || {});
      setOutputs(parsed.outputs || {});
    }
    axios.get(`${API}/sessions/${sessionId}`).then(async (r) => {
      if (r.data.submitted) {
        navigate(`/results/${sessionId}`);
        return;
      }
      setSession(r.data);
      const q = await axios.get(`${API}/sets/${r.data.set_id}/questions`);
      setSetData(q.data);
      const elapsed = (Date.now() - new Date(r.data.started_at).getTime()) / 1000;
      setSecondsLeft(Math.max(0, Math.floor(q.data.duration_minutes * 60 - elapsed)));
    }).catch(() => toast.error("Session not found"));
  }, [sessionId, navigate]);

  useEffect(() => { answersRef.current = answers; outputsRef.current = outputs; }, [answers, outputs]);

  useEffect(() => {
    const t = setInterval(() => {
      localStorage.setItem(`answers-${sessionId}`, JSON.stringify({ answers: answersRef.current, outputs: outputsRef.current }));
    }, 5000);
    return () => clearInterval(t);
  }, [sessionId]);

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    if (auto) toast.info("Time is up — submitting your answers");
    try {
      const payload = {
        answers: Object.keys(answersRef.current).map((qid) => ({
          qid: parseInt(qid),
          answer: answersRef.current[qid] || "",
          execution_output: outputsRef.current[qid]?.text || null,
        })),
      };
      await axios.post(`${API}/sessions/${sessionId}/submit`, payload, { timeout: 300000 });
      localStorage.removeItem(`answers-${sessionId}`);
      navigate(`/results/${sessionId}`);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      toast.error("Submission failed — try again");
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) { submit(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submit]);

  const runCode = useCallback(async () => {
    const q = setData.questions[current];
    const code = answersRef.current[q.qid] || "";
    if (!code.trim()) { toast.error("Write some code first"); return; }
    setRunning(true);
    try {
      let text;
      if (q.type === "sql") {
        const r = await axios.post(`${API}/execute/sql`, { sql: code });
        text = formatSqlResult(r.data);
      } else {
        const r = await axios.post(`${API}/execute/python`, { code });
        text = formatPyResult(r.data);
      }
      setOutputs((o) => ({ ...o, [q.qid]: { text } }));
    } catch (e) {
      setOutputs((o) => ({ ...o, [q.qid]: { text: "Execution request failed" } }));
    }
    setRunning(false);
  }, [setData, current]);

  if (!setData || !session) return <LoadingScreen />;
  if (submitting) return <GradingScreen />;

  const q = setData.questions[current];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TestHeader setTitle={setData.title} candidateName={session.candidate_name} secondsLeft={secondsLeft} onSubmit={() => submit(false)} />
      <div className="flex flex-1 flex-col md:flex-row">
        <SidebarNav questions={setData.questions} current={current} answers={answers} onSelect={setCurrent} />
        <main className="flex flex-1 flex-col lg:flex-row">
          <QuestionPanel q={q} current={current} onNav={setCurrent} />
          <AnswerPanel
            q={q}
            value={answers[q.qid] || ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.qid]: v }))}
            output={outputs[q.qid]?.text}
            running={running}
            onRun={runCode}
          />
        </main>
      </div>
    </div>
  );
}
