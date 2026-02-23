import { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  MODULE_ADDRESS,
  MODULE_NAME,
  aptos,
  getJobStatus,
  getEscrowAmount,
  jobStatusLabel,
  octasToApt,
} from "../aptos";
import { formatTxError, getErrorCategory } from "../utils/log";
import type { LogLine } from "./TerminalLog";
import type { TimelineSteps } from "./TransactionTimeline";

interface MilestoneProps {
  jobId: number | null;
  onSuccess: () => void;
  addLog: (line: Omit<LogLine, "id">) => void;
  timeline?: { start: () => void; update: (p: Partial<TimelineSteps>) => void };
}

export function Milestone({ jobId, onSuccess, addLog, timeline }: MilestoneProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [loading, setLoading] = useState<string | null>(null);
  const [bidId, setBidId] = useState("");
  const [fundAmount, setFundAmount] = useState("");

  const runTx = async (
    label: string,
    fn: string,
    args: (string | number)[],
    milestoneIndex: number | null = null
  ) => {
    if (!account || !jobId) return;
    setLoading(label);
    timeline?.start();
    addLog({ text: `> ${fn} executing...`, type: "default" });
    try {
      const res = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::${fn}`,
          functionArguments: args,
        },
      });
      timeline?.update({ submitted: true });
      addLog({ text: "> submitted", type: "default" });
      await aptos.waitForTransaction({ transactionHash: res.hash });
      timeline?.update({ confirmed: true });
      addLog({ text: "> confirmed", type: "success" });
      if (fn === "release_milestone" && milestoneIndex !== null) {
        timeline?.update({ escrowUpdated: true });
        addLog({
          text: `> milestone[${milestoneIndex}] released`,
          type: "success",
        });
        addLog({ text: "> escrow balance updated", type: "default" });
        try {
          const status = await getJobStatus(jobId);
          const escrow = await getEscrowAmount(jobId);
          addLog({
            text: `> job status: ${jobStatusLabel(status)}`,
            type: "default",
          });
          addLog({
            text: `> escrow: ${octasToApt(escrow)} APT`,
            type: "default",
          });
        } catch {
          // ignore view errors
        }
      }
      timeline?.update({ completed: true });
      addLog({
        text: `> tx: https://explorer.aptoslabs.com/txn/${res.hash}?network=testnet`,
        type: "tx",
      });
      onSuccess();
    } catch (e: unknown) {
      addLog({
        text: formatTxError(e),
        type: getErrorCategory(e),
      });
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
          onClick={() =>
            jobId != null &&
            runTx("accept_bid", "accept_bid", [jobId as number, bidIdNum])
          }
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
          onClick={() =>
            jobId != null &&
            runTx("fund_escrow", "fund_escrow", [jobId as number, fundAmountNum])
          }
          disabled={!account || !jobId || !!loading || Number.isNaN(fundAmountNum) || fundAmountNum <= 0}
        >
          {loading === "fund_escrow" ? "..." : "fund_escrow"}
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() =>
              jobId != null &&
              runTx("release_milestone_0", "release_milestone", [jobId as number, 0], 0)
            }
            disabled={!account || !jobId || !!loading}
          >
            {loading === "release_milestone_0" ? "..." : "release_milestone 0"}
          </button>
          <button
            className="btn"
            onClick={() =>
              jobId != null &&
              runTx("release_milestone_1", "release_milestone", [jobId as number, 1], 1)
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
