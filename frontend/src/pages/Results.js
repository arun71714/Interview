import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, CheckCircle2, XCircle, Award, ChevronDown, ChevronUp, Home } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VERDICT_STYLE = {
  "STRONG SHORTLIST": "bg-emerald-500 text-white",
  PASS: "bg-slate-950 text-white",
  FAIL: "bg-red-500 text-white",
};

function verdictIcon(verdict) {
  if (verdict === "FAIL") return <XCircle className="h-4 w-4" strokeWidth={1.5} />;
  if (verdict === "PASS") return <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />;
  return <Award className="h-4 w-4" strokeWidth={1.5} />;
}

function scoreBadgeClass(score) {
  if (score >= 4) return "bg-emerald-500 text-white";
  if (score >= 2.5) return "bg-amber-500 text-white";
  return "bg-red-500 text-white";
}

export default function Results() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    axios.get(`${API}/results/session/${sessionId}`)
      .then((r) => setResult(r.data))
      .catch(() => setError(true));
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <p className="text-sm text-slate-600">No result found for this session.</p>
        <button onClick={() => navigate("/")} className="mt-4 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] hover:bg-slate-950 hover:text-white">Home</button>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  const pct = Math.round((result.total / result.max_marks) * 100);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-heading text-lg font-black tracking-tighter">NNE ASSESSMENT LAB</span>
          <button data-testid="results-home-button" onClick={() => navigate("/")} className="flex items-center gap-2 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white">
            <Home className="h-4 w-4" strokeWidth={1.5} /> Home
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="border border-slate-950">
          <div className="grid md:grid-cols-3">
            <div className="border-b border-slate-950 p-6 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Candidate</p>
              <h1 className="mt-2 font-heading text-2xl font-black tracking-tighter">{result.candidate_name}</h1>
              <p className="font-mono text-xs text-slate-500">{result.email}</p>
              <p className="mt-2 text-sm font-bold">{result.set_title}</p>
            </div>
            <div className="border-b border-slate-950 p-6 md:border-b-0 md:border-r">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Total Score</p>
              <p data-testid="total-score" className="mt-2 font-mono text-5xl font-bold">
                {result.total}<span className="text-2xl text-slate-400">/{result.max_marks}</span>
              </p>
              <p className="font-mono text-xs text-slate-500">{pct}% · cut-off {result.cutoff} · strong {result.strong}+</p>
            </div>
            <div className="flex flex-col justify-center p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Verdict</p>
              <div data-testid="verdict-badge" className={`mt-3 inline-flex w-fit items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-[0.2em] ${VERDICT_STYLE[result.verdict]}`}>
                {verdictIcon(result.verdict)}
                {result.verdict}
              </div>
            </div>
          </div>
        </div>

        <h2 className="mt-10 font-heading text-2xl font-bold tracking-tight">Per-Question Breakdown</h2>
        <div className="mt-4 border border-slate-200">
          {result.per_question.map((q) => (
            <div key={q.qid} className="border-b border-slate-200 last:border-b-0">
              <button
                data-testid={`question-result-${q.qid}`}
                onClick={() => setExpanded((e) => ({ ...e, [q.qid]: !e[q.qid] }))}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-all duration-150 hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <span className={`flex h-9 w-12 items-center justify-center font-mono text-sm font-bold ${scoreBadgeClass(q.score)}`}>
                    {q.score}/5
                  </span>
                  <div>
                    <p className="text-sm font-bold">Q{q.qid}. {q.skill}</p>
                    <p className="font-mono text-xs uppercase text-slate-500">{q.type}</p>
                  </div>
                </div>
                {expanded[q.qid] ? <ChevronUp className="h-4 w-4" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4" strokeWidth={1.5} />}
              </button>
              {expanded[q.qid] && (
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Question</p>
                  <p className="mt-1 text-sm text-slate-800">{q.question}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Your Answer</p>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap border border-slate-200 bg-white p-3 font-mono text-xs">{q.answer || "(no answer)"}</pre>
                  {q.execution_output && (
                    <>
                      <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Execution Output</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap border border-slate-200 bg-white p-3 font-mono text-xs">{q.execution_output}</pre>
                    </>
                  )}
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Examiner Feedback</p>
                  <p className="mt-1 text-sm text-slate-800">{q.feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
