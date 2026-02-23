import { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { MODULE_ADDRESS, MODULE_NAME } from "../aptos";
import type { LogLine } from "./TerminalLog";

interface MilestoneProps {
  jobId: number | null;
  onSuccess: () => void;
  addLog: (line: Omit<LogLine, "id">) => void;
}

export function Milestone({ jobId, onSuccess, addLog }: MilestoneProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [loading, setLoading] = useState<string | null>(null);
  const [bidId, setBidId] = useState("");
  const [fundAmount, setFundAmount] = useState("");

  const runTx = async (
    label: string,
    fn: string,
    args: unknown[]
  ) => {
    if (!account || !jobId) return;
    setLoading(label);
    addLog({ text: `> ${fn} executing...`, type: "default" });
    try {
      const res = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::${fn}`,
          functionArguments: args as (string | number)[],
        },
      });
      addLog({ text: `> ${fn} executed`, type: "success" });
      addLog({
        text: `> tx: https://explorer.aptoslabs.com/txn/${res.hash}?network=testnet`,
        type: "tx",
      });
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog({ text: `> error: ${msg}`, type: "error" });
    } finally {
      setLoading(null);
    }
  };

  const bidIdNum = parseInt(bidId.trim(), 10);
  const fundAmountNum = parseInt(fundAmount.trim(), 10);

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-title">4. accept_bid · fund_escrow · release_milestone</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Job ID: {jobId ?? "—"}
        </div>
        <input
          placeholder="Bid ID to accept"
          value={bidId}
          onChange={(e) => setBidId(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => runTx("accept_bid", "accept_bid", [jobId, bidIdNum])}
          disabled={!account || !jobId || !!loading || Number.isNaN(bidIdNum) || bidIdNum < 1}
        >
          {loading === "accept_bid" ? "..." : "accept_bid"}
        </button>
        <input
          placeholder="Amount to fund escrow (octas)"
          value={fundAmount}
          onChange={(e) => setFundAmount(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => runTx("fund_escrow", "fund_escrow", [jobId, fundAmountNum])}
          disabled={!account || !jobId || !!loading || Number.isNaN(fundAmountNum) || fundAmountNum <= 0}
        >
          {loading === "fund_escrow" ? "..." : "fund_escrow"}
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() =>
              runTx("release_milestone_0", "release_milestone", [jobId, 0])
            }
            disabled={!account || !jobId || !!loading}
          >
            {loading === "release_milestone_0" ? "..." : "release_milestone 0"}
          </button>
          <button
            className="btn"
            onClick={() =>
              runTx("release_milestone_1", "release_milestone", [jobId, 1])
            }
            disabled={!account || !jobId || !!loading}
          >
            {loading === "release_milestone_1" ? "..." : "release_milestone 1"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
