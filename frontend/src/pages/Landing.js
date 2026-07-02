import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Terminal, Database, Code2, Clock, ArrowRight, History as HistoryIcon } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Landing() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [setId, setSetId] = useState("A");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/sets`).then((r) => setSets(r.data)).catch(() => {});
  }, []);

  const startTest = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Enter your name and email to begin");
      return;
    }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/sessions`, { candidate_name: name, email, set_id: setId });
      navigate(`/test/${r.data.id}`);
    } catch (e) {
      toast.error("Could not start session");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Terminal className="h-6 w-6" strokeWidth={1.5} />
            <span className="font-heading text-lg font-black tracking-tighter">NNE ASSESSMENT LAB</span>
          </div>
          <button
            data-testid="nav-history-link"
            onClick={() => navigate("/history")}
            className="flex items-center gap-2 border border-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:bg-slate-950 hover:text-white"
          >
            <HistoryIcon className="h-4 w-4" strokeWidth={1.5} /> Results History
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">First-Round Technical Screening</p>
            <h1 className="mt-4 font-heading text-4xl font-black tracking-tighter sm:text-5xl">
              SQL · Python · DAX<br />Answer Tester
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-slate-800">
              Two role-specific question sets for Data Analyst screening. Write and execute real SQL and Python,
              draft DAX measures, and answer scenario questions. Every answer is graded by AI against the official
              answer key.
            </p>

            <div className="mt-10 grid grid-cols-3 border border-slate-200">
              {[
                { icon: Database, label: "Live SQL Runner", sub: "SQLite engine" },
                { icon: Code2, label: "Python Sandbox", sub: "pandas ready" },
                { icon: Clock, label: "30 Minutes", sub: "20 questions" },
              ].map((f, i) => (
                <div key={i} className={`p-4 ${i < 2 ? "border-r border-slate-200" : ""}`}>
                  <f.icon className="h-5 w-5" strokeWidth={1.5} />
                  <p className="mt-3 text-sm font-bold">{f.label}</p>
                  <p className="font-mono text-xs text-slate-500">{f.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Scoring</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-slate-700">
                <li>Set A — Advanced: cut-off 65/100 · strong 75+</li>
                <li>Set B — Senior: cut-off 75/100 · strong 85+</li>
                <li>20 questions × 5 marks · AI-graded with execution results</li>
              </ul>
            </div>
          </div>

          <div className="border border-slate-950 bg-white">
            <div className="border-b border-slate-950 bg-slate-950 px-6 py-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white">candidate://register</p>
            </div>
            <div className="space-y-6 p-6 md:p-8">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Full Name</label>
                <input
                  data-testid="candidate-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Analyst"
                  className="mt-2 w-full border border-slate-300 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Email</label>
                <input
                  data-testid="candidate-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="mt-2 w-full border border-slate-300 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Question Set</label>
                <div className="mt-2 grid grid-cols-1 gap-3">
                  {(sets.length ? sets : [
                    { set_id: "A", title: "Set A — Advanced Data Analyst", cutoff: 65, strong: 75 },
                    { set_id: "B", title: "Set B — Senior Data Analyst", cutoff: 75, strong: 85 },
                  ]).map((s) => (
                    <button
                      key={s.set_id}
                      data-testid={`select-set-${s.set_id}`}
                      onClick={() => setSetId(s.set_id)}
                      className={`flex items-center justify-between border px-4 py-3 text-left transition-all duration-150 ${
                        setId === s.set_id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-300 hover:border-slate-950"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{s.title}</p>
                        <p className={`font-mono text-xs ${setId === s.set_id ? "text-slate-300" : "text-slate-500"}`}>
                          cut-off {s.cutoff}/100 · strong {s.strong}+
                        </p>
                      </div>
                      <div className={`h-3 w-3 border ${setId === s.set_id ? "border-white bg-white" : "border-slate-400"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                data-testid="start-test-button"
                onClick={startTest}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 bg-slate-950 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition-all duration-150 hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Starting..." : "Begin 30-Min Test"} <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <p className="font-mono text-xs text-slate-500">
                Timer starts immediately. The test auto-submits when time runs out.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
