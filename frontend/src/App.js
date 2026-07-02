import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Test from "@/pages/Test";
import Results from "@/pages/Results";
import History from "@/pages/History";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/test/:sessionId" element={<Test />} />
          <Route path="/results/:sessionId" element={<Results />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: 0, fontFamily: "'IBM Plex Sans', sans-serif" } }} />
    </div>
  );
}

export default App;
