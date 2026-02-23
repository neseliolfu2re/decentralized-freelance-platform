import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getJobCounter, getEscrowAmount, octasToApt } from "../aptos";

interface EscrowHealthPanelProps {
  refreshTrigger: number;
}

export function EscrowHealthPanel({ refreshTrigger }: EscrowHealthPanelProps) {
  const [activeJobs, setActiveJobs] = useState(0);
  const [totalLocked, setTotalLocked] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const count = await getJobCounter();
        if (count === 0) {
          setActiveJobs(0);
          setTotalLocked(0);
          return;
        }
        let total = 0;
        for (let id = 1; id <= count; id++) {
          try {
            const escrow = await getEscrowAmount(id);
            total += escrow;
          } catch {
            // skip
          }
        }
        if (!cancelled) {
          setActiveJobs(count);
          setTotalLocked(total);
        }
      } catch {
        if (!cancelled) setActiveJobs(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return (
    <motion.div
      className="escrow-health-panel"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-title">system_status</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
        <div style={{ color: "var(--green)" }}>STATUS: ONLINE</div>
        <div style={{ color: "var(--muted)" }}>NETWORK: TESTNET</div>
        <div style={{ color: "var(--muted)" }}>
          ACTIVE JOBS: {loading ? "—" : activeJobs}
        </div>
        <div style={{ color: "var(--muted)" }}>
          TOTAL LOCKED: {loading ? "—" : `${octasToApt(totalLocked)} APT`}
        </div>
      </div>
    </motion.div>
  );
}
