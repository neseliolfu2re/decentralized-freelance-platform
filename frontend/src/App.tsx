import { useState, useCallback, useRef } from "react";
import Typewriter from "typewriter-effect";
import { motion } from "framer-motion";
import { Navbar } from "./components/Navbar";
import { TerminalLog, type LogLine } from "./components/TerminalLog";
import { TransactionTimeline, type TimelineSteps } from "./components/TransactionTimeline";
import { EscrowHealthPanel } from "./components/EscrowHealthPanel";
import { CreateJob } from "./components/CreateJob";
import { JobList } from "./components/JobList";
import { PlaceBid } from "./components/PlaceBid";
import { Milestone } from "./components/Milestone";
import "./App.css";

const INITIAL_TIMELINE: TimelineSteps = {
  submitted: false,
  confirmed: false,
  escrowUpdated: false,
  completed: false,
};

function App() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logIdRef = useRef(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineSteps, setTimelineSteps] = useState<TimelineSteps>(INITIAL_TIMELINE);

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

  const startTimeline = useCallback(() => {
    setTimelineVisible(true);
    setTimelineSteps(INITIAL_TIMELINE);
  }, []);

  const updateTimeline = useCallback((partial: Partial<TimelineSteps>) => {
    setTimelineSteps((prev) => ({ ...prev, ...partial }));
  }, []);

  const timeline = { start: startTimeline, update: updateTimeline };

  return (
    <div className="app">
      <Navbar />

      <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
        {/* Hero */}
        <motion.section
          style={{
            textAlign: "center",
            marginBottom: 32,
            paddingBottom: 24,
            borderBottom: "1px solid var(--border)",
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            style={{
              color: "var(--green)",
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "0.02em",
              margin: 0,
              marginBottom: 8,
            }}
          >
            Decentralized Freelance Escrow
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
            Built on Aptos
          </p>
          <p
            style={{
              color: "var(--text)",
              fontSize: "0.75rem",
              margin: "8px 0 0",
            }}
          >
            Trustless. Milestone-based. On-chain.
          </p>
        </motion.section>

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
            <CreateJob
              onSuccess={refresh}
              addLog={addLog}
              timeline={timeline}
            />
            <JobList
              refreshTrigger={refreshTrigger}
              onSelectJob={setSelectedJobId}
              selectedJobId={selectedJobId}
            />
            <PlaceBid
              jobId={selectedJobId}
              onSuccess={refresh}
              addLog={addLog}
              timeline={timeline}
            />
            <Milestone
              jobId={selectedJobId}
              onSuccess={refresh}
              addLog={addLog}
              timeline={timeline}
            />
          </div>

          <motion.div
            style={{ position: "sticky", top: 24 }}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <EscrowHealthPanel refreshTrigger={refreshTrigger} />
            <TransactionTimeline visible={timelineVisible} steps={timelineSteps} />
            <TerminalLog lines={logs} title="> system_log" />
          </motion.div>
        </div>
      </main>

      {/* Corner blinking cursor */}
      <div className="corner-cursor cursor-blink" aria-hidden>
        &gt;
      </div>
    </div>
  );
}

export default App;
