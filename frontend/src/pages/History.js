import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, Download, Home, Lock, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VERDICT_STYLE = {
  "STRONG SHORTLIST": "bg-emerald-500 text-white",
  PASS: "bg-slate-950 text-white",
  FAIL: "bg-red-500 text-white",
};

function formatApiErrorDetail(detail) {
  if (detail == null) return "Login failed. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : "")).filter(Boolean).join(" ") || "Login failed";
  }
  return "Login failed";
}

const AdminLogin = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
      onLogin();
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail));
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto mt-16 max-w-md border border-slate-950">
      <div className="border-b border-slate-950 bg-slate-950 px-6 py-3">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-white">
          <Lock className="h-4 w-4" strokeWidth={1.5} /> admin://login
        </p>
      </div>
      <form onSubmit={login} className="space-y-5 p-6 md:p-8">
        <p className="text-sm text-slate-600">Results history is restricted. Sign in with the admin account.</p>
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Email</label>
          <input
            data-testid="admin-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border border-slate-300 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Password</label>
          <input
            data-testid="admin-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full border border-slate-300 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
        </div>
        {error && <p data-testid="admin-login-error" className="font-mono text-xs text-red-500">{error}</p>}
        <button
          data-testid="admin-login-button"
          type="submit"
          disabled={loading}
          className="w-full bg-slate-950 px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition-all duration-150 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};

const ResultsTable = ({ results, onView, onDelete }) => (
  <div className="mt-6 overflow-x-auto border border-slate-200">
    <table className="w-full text-sm" data-testid="results-table">
      <thead>
        <tr className="border-b border-slate-950 bg-slate-50 text-left">
          {["Candidate", "Email", "Set", "Score", "Verdict", "Submitted", "Actions"].map((h) => (
            <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
            <td className="px-4 py-3 font-bold">{r.candidate_name}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.email}</td>
            <td className="px-4 py-3 font-mono">{r.set_id}</td>
            <td className="px-4 py-3 font-mono font-bold">{r.total}/{r.max_marks}</td>
            <td className="px-4 py-3">
              <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
            </td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString()}</td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <button
                  data-testid={`view-result-${r.session_id}`}
                  onClick={() => onView(r.session_id)}
                  className="border border-slate-950 px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all duration-150 hover:bg-slate-950 hover:text-white"
                >
                  View
                </button>
                <button
                  data-testid={`delete-result-${r.session_id}`}
                  onClick={() => onDelete(r)}
                  className="border border-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-500 transition-all duration-150 hover:bg-red-500 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function exportResultsCsv(results) {
  const header = "Candidate,Email,Set,Total,Max,Cutoff,Verdict,Submitted At";
  const rows = results.map((r) =>
    [r.candidate_name, r.email, r.set_id, r.total, r.max_marks, r.cutoff, r.verdict, r.submitted_at]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "assessment_results.csv";
  a.click();
}

export default function History() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(null);
  const [results, setResults] = useState(null);

  const fetchResults = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/results`, { withCredentials: true });
      setResults(r.data);
    } catch (e) {
      if (e.response?.status === 401) {
        setAuthed(false);
      } else {
        setResults([]);
      }
    }
  }, []);

  useEffect(() => {
    axios.get(`${API}/auth/me`, { withCredentials: true })
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed === true) fetchResults();
  }, [authed, fetchResults]);

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } finally {
      setAuthed(false);
      setResults(null);
    }
  };

  const deleteResult = async (r) => {
    if (!window.confirm(`Delete result of "${r.candidate_name}" (${r.total}/${r.max_marks})? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/results/${r.id}`, { withCredentials: true });
      toast.success("Result deleted");
      fetchResults();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const clearAll = async () => {
    if (!window.confirm(`Delete ALL ${results.length} results? This cannot be undone.`)) return;
    try {
      const r = await axios.delete(`${API}/results`, { withCredentials: true });
      toast.success(`Cleared ${r.data.deleted} results`);
      fetchResults();
    } catch (e) {
      toast.error("Clear failed");
    }
  };

  const renderBody = () => {
    if (authed === null) {
      return <div className="mt-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.5} /></div>;
    }
    if (authed === false) {
      return <AdminLogin onLogin={() => setAuthed(true)} />;
    }
    return (
      <>
        <h1 className="font-heading text-3xl font-black tracking-tighter">Results History</h1>
        {!results && <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.5} /></div>}
        {results && results.length === 0 && <p className="mt-6 text-sm text-slate-600">No candidates have completed a test yet.</p>}
        {results && results.length > 0 && <ResultsTable results={results} onView={(sid) => navigate(`/results/${sid}`)} onDelete={deleteResult} />}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-heading text-lg font-black tracking-tighter">NNE ASSESSMENT LAB</span>
          <div className="flex gap-2">
            {authed === true && (
              <>
                <button
                  data-testid="clear-history-button"
                  onClick={clearAll}
                  disabled={!results?.length}
                  className="flex items-center gap-2 border border-red-500 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-500 transition-all duration-150 hover:bg-red-500 hover:text-white disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Clear All
                </button>
                <button
                  data-testid="export-csv-button"
                  onClick={() => exportResultsCsv(results)}
                  disabled={!results?.length}
                  className="flex items-center gap-2 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white disabled:opacity-30"
                >
                  <Download className="h-4 w-4" strokeWidth={1.5} /> Export CSV
                </button>
                <button
                  data-testid="admin-logout-button"
                  onClick={logout}
                  className="flex items-center gap-2 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.5} /> Logout
                </button>
              </>
            )}
            <button
              data-testid="history-home-button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white"
            >
              <Home className="h-4 w-4" strokeWidth={1.5} /> Home
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{renderBody()}</main>
    </div>
  );
}
