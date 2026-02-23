import { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { MODULE_ADDRESS, MODULE_NAME } from "../aptos";
import type { LogLine } from "./TerminalLog";

interface PlaceBidProps {
  jobId: number | null;
  onSuccess: () => void;
  addLog: (line: Omit<LogLine, "id">) => void;
}

export function PlaceBid({ jobId, onSuccess, addLog }: PlaceBidProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!account || !jobId) return;
    const amt = parseInt(amount.trim(), 10);
    if (Number.isNaN(amt) || amt <= 0) return;
    setLoading(true);
    addLog({ text: "> place_bid executing...", type: "default" });
    try {
      const res = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::place_bid`,
          functionArguments: [jobId, amt, message || "Bid"],
        },
      });
      addLog({ text: "> place_bid executed", type: "success" });
      addLog({
        text: `> tx: https://explorer.aptoslabs.com/txn/${res.hash}?network=testnet`,
        type: "tx",
      });
      setAmount("");
      setMessage("");
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog({ text: `> error: ${msg}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-title">3. place_bid</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Job ID: {jobId ?? "—"}
        </div>
        <input
          placeholder="Amount (octas)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          placeholder="Proposal text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={!account || !jobId || loading}
        >
          {loading ? "..." : "place_bid"}
        </button>
      </div>
    </motion.div>
  );
}
