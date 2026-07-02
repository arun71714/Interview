import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Play, Send, Loader2, Database, Code2, Braces, FileText, ChevronLeft, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TYPE_ICON = { sql: Database, python: Code2, dax: Braces, text: FileText };
const TYPE_LABEL = { sql: "SQL — executable", python: "Python — executable", dax: "DAX — AI graded", text: "Written answer — AI graded" };

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

  if (!setData || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <Loader2 className="h-10 w-10 animate-spin" strokeWidth={1.5} />
        <h2 className="mt-6 font-heading text-2xl font-bold tracking-tight">AI grading in progress</h2>
        <p className="mt-2 max-w-md text-center text-sm text-slate-600">
          Claude is evaluating all 20 answers against the official answer key. This takes 30–90 seconds.
        </p>
      </div>
    );
  }

  const q = setData.questions[current];
  const executable = q.type === "sql" || q.type === "python";
  const codeType = q.type === "sql" || q.type === "python" || q.type === "dax";
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const Icon = TYPE_ICON[q.type];
  const answered = Object.keys(answers).filter((k) => (answers[k] || "").trim()).length;

  const runCode = async () => {
    const code = answers[q.qid] || "";
    if (!code.trim()) { toast.error("Write some code first"); return; }
    setRunning(true);
    try {
      let text;
      if (q.type === "sql") {
        const r = await axios.post(`${API}/execute/sql`, { sql: code });
        if (r.data.success) {
          const header = r.data.columns.join(" | ");
          const rows = r.data.rows.map((row) => row.map((c) => (c === null ? "NULL" : c)).join(" | ")).join("\n");
          text = r.data.columns.length ? `${header}\n${"-".repeat(header.length)}\n${rows}\n(${r.data.row_count} rows)` : "Statement executed (no result set)";
        } else {
          text = `SQL ERROR: ${r.data.error}`;
        }
      } else {
        const r = await axios.post(`${API}/execute/python`, { code });
        text = r.data.error ? `ERROR: ${r.data.error}` : `${r.data.stdout || ""}${r.data.stderr ? `\nSTDERR:\n${r.data.stderr}` : ""}`.trim() || "(no output)";
      }
      setOutputs((o) => ({ ...o, [q.qid]: { text } }));
    } catch (e) {
      setOutputs((o) => ({ ...o, [q.qid]: { text: "Execution request failed" } }));
    }
    setRunning(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-950 bg-white">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{setData.title}</p>
            <p className="text-sm font-bold">{session.candidate_name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div data-testid="test-timer" className={`font-mono text-2xl font-bold ${secondsLeft < 300 ? "text-red-500" : "text-slate-950"}`}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <button
              data-testid="submit-test-button"
              onClick={() => submit(false)}
              className="flex items-center gap-2 bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all duration-150 hover:bg-slate-800"
            >
              <Send className="h-4 w-4" strokeWidth={1.5} /> Submit
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-slate-200 p-4 md:w-56 md:border-b-0 md:border-r">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Questions — {answered}/20</p>
          <div className="mt-3 grid grid-cols-10 gap-1 md:grid-cols-5 md:gap-2">
            {setData.questions.map((qq, i) => {
              const done = (answers[qq.qid] || "").trim();
              return (
                <button
                  key={qq.qid}
                  data-testid={`question-nav-${qq.qid}`}
                  onClick={() => setCurrent(i)}
                  className={`flex h-9 w-full items-center justify-center border text-xs font-bold transition-all duration-150 ${
                    i === current
                      ? "border-slate-950 ring-2 ring-slate-950 ring-offset-1"
                      : done
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-950"
                  }`}
                >
                  {qq.qid}
                </button>
              );
            })}
          </div>
          <div className="mt-6 hidden space-y-2 font-mono text-xs text-slate-500 md:block">
            <p><span className="mr-2 inline-block h-3 w-3 border border-slate-950 bg-slate-950 align-middle" />answered</p>
            <p><span className="mr-2 inline-block h-3 w-3 border border-slate-200 bg-slate-100 align-middle" />pending</p>
          </div>
        </aside>

        <main className="flex flex-1 flex-col lg:flex-row">
          <section className="flex-1 border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{TYPE_LABEL[q.type]}</span>
              </div>
              <span className="font-mono text-xs text-slate-500">{q.marks} marks · {q.level}</span>
            </div>
            <h2 className="mt-4 font-heading text-xl font-bold tracking-tight">
              Q{q.qid}. {q.skill}
            </h2>
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
                onClick={() => setCurrent((c) => c - 1)}
                className="flex items-center gap-1 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Prev
              </button>
              <button
                data-testid="next-question-button"
                disabled={current === 19}
                onClick={() => setCurrent((c) => c + 1)}
                className="flex items-center gap-1 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white disabled:opacity-30"
              >
                Next <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </section>

          <section className="flex flex-1 flex-col p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Your Answer</p>
              {executable && (
                <button
                  data-testid="run-code-button"
                  onClick={runCode}
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
              value={answers[q.qid] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.qid]: e.target.value }))}
              spellCheck={false}
              placeholder={
                q.type === "sql" ? "-- Write your SQL here, then press Run" :
                q.type === "python" ? "# Write pandas code here, then press Run\nimport pandas as pd" :
                q.type === "dax" ? "// Write your DAX measure here (graded by AI)" :
                "Write your answer here..."
              }
              className={`mt-3 min-h-[220px] w-full flex-1 p-4 text-sm leading-relaxed ${
                codeType ? "code-editor" : "border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-950"
              }`}
            />
            {executable && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Output</p>
                <pre data-testid="execution-output" className="mt-2 max-h-52 min-h-[80px] overflow-auto border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
                  {outputs[q.qid]?.text || "Run your code to see output here."}
                </pre>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
