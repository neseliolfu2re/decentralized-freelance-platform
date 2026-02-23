import { useState, useCallback, useRef } from "react";
import Typewriter from "typewriter-effect";
import { motion } from "framer-motion";
import { Navbar } from "./components/Navbar";
import { TerminalLog, type LogLine } from "./components/TerminalLog";
import { CreateJob } from "./components/CreateJob";
import { JobList } from "./components/JobList";
import { PlaceBid } from "./components/PlaceBid";
import { Milestone } from "./components/Milestone";
import "./App.css";

function App() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logIdRef = useRef(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const addLog = useCallback(
    (line: Omit<LogLine, "id">) => {
      const id = ++logIdRef.current;
      setLogs((prev) => [...prev.slice(-98), { ...line, id }]);
    },
    []
  );

  const refresh = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  return (
    <div className="app">
      <Navbar />

      <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
        {/* Boot typewriter */}
        <motion.div
          style={{
            color: "var(--green)",
            fontFamily: "inherit",
            marginBottom: 24,
            minHeight: 60,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Typewriter
            options={{
              strings: [
                "> Initializing Freelance Escrow...",
                "> Connecting to Aptos Testnet...",
                "> System Ready.",
              ],
              autoStart: true,
              loop: false,
              delay: 50,
              deleteSpeed: 30,
            }}
          />
          <span className="cursor-blink" />
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div>
            <CreateJob onSuccess={refresh} addLog={addLog} />
            <JobList
              refreshTrigger={refreshTrigger}
              onSelectJob={setSelectedJobId}
              selectedJobId={selectedJobId}
            />
            <PlaceBid jobId={selectedJobId} onSuccess={refresh} addLog={addLog} />
            <Milestone
              jobId={selectedJobId}
              onSuccess={refresh}
              addLog={addLog}
            />
          </div>

          <motion.div
            style={{ position: "sticky", top: 24 }}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <TerminalLog lines={logs} title="> system_log" />
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default App;
