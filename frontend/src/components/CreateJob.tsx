import { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { MODULE_ADDRESS, MODULE_NAME, OCTAS_PER_APT } from "../aptos";
import type { LogLine } from "./TerminalLog";

interface CreateJobProps {
  onSuccess: () => void;
  addLog: (line: Omit<LogLine, "id">) => void;
}

export function CreateJob({ onSuccess, addLog }: CreateJobProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestonesInput, setMilestonesInput] = useState("10000000, 10000000");
  const [loading, setLoading] = useState(false);

  const amounts = milestonesInput
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const budget = amounts.reduce((a, b) => a + b, 0);
  const budgetApt = (budget / OCTAS_PER_APT).toFixed(2);

  const handleSubmit = async () => {
    if (!account || amounts.length === 0) return;
    setLoading(true);
    addLog({ text: "> create_job executing...", type: "default" });
    try {
      const res = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_job`,
          functionArguments: [title, description, amounts, 0],
        },
      });
      addLog({ text: `> create_job executed`, type: "success" });
      addLog({
        text: `> tx: https://explorer.aptoslabs.com/txn/${res.hash}?network=testnet`,
        type: "tx",
      });
      setTitle("");
      setDescription("");
      setMilestonesInput("10000000, 10000000");
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
      <div className="card-title">1. create_job</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <input
          placeholder="Milestones (octas, comma separated)"
          value={milestonesInput}
          onChange={(e) => setMilestonesInput(e.target.value)}
        />
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Budget (auto): {budgetApt} APT
        </div>
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={!account || loading || !title.trim() || !description.trim()}
        >
          {loading ? "..." : "create_job"}
        </button>
      </div>
    </motion.div>
  );
}
