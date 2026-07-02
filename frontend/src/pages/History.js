import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Download, Home, Lock, LogOut } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VERDICT_STYLE = {
  "STRONG SHORTLIST": "bg-emerald-500 text-white",
  PASS: "bg-slate-950 text-white",
  FAIL: "bg-red-500 text-white",
};

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem("admin_token", data.access_token);
      onLogin(data.access_token);
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : "Login failed");
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
}

export default function History() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem("admin_token"));
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/results`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setResults(r.data))
      .catch((e) => {
        if (e.response?.status === 401) {
          localStorage.removeItem("admin_token");
          setToken(null);
          toast.error("Session expired — sign in again");
        } else {
          setResults([]);
        }
      });
  }, [token]);

  const logout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
    setResults(null);
  };

  const exportCsv = () => {
    const header = "Candidate,Email,Set,Total,Max,Cutoff,Verdict,Submitted At";
    const rows = results.map((r) =>
      [r.candidate_name, r.email, r.set_id, r.total, r.max_marks, r.cutoff, r.verdict, r.submitted_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "assessment_results.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-heading text-lg font-black tracking-tighter">NNE ASSESSMENT LAB</span>
          <div className="flex gap-2">
            {token && (
              <>
                <button
                  data-testid="export-csv-button"
                  onClick={exportCsv}
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        {!token ? (
          <AdminLogin onLogin={setToken} />
        ) : (
          <>
            <h1 className="font-heading text-3xl font-black tracking-tighter">Results History</h1>
            {!results ? (
              <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.5} /></div>
            ) : results.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">No candidates have completed a test yet.</p>
            ) : (
              <div className="mt-6 overflow-x-auto border border-slate-200">
                <table className="w-full text-sm" data-testid="results-table">
                  <thead>
                    <tr className="border-b border-slate-950 bg-slate-50 text-left">
                      {["Candidate", "Email", "Set", "Score", "Verdict", "Submitted", ""].map((h) => (
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
                          <button
                            data-testid={`view-result-${r.session_id}`}
                            onClick={() => navigate(`/results/${r.session_id}`)}
                            className="border border-slate-950 px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all duration-150 hover:bg-slate-950 hover:text-white"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
