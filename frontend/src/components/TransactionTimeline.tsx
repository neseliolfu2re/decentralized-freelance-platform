import { motion } from "framer-motion";

export interface TimelineSteps {
  submitted: boolean;
  confirmed: boolean;
  escrowUpdated: boolean;
  completed: boolean;
}

interface TransactionTimelineProps {
  visible: boolean;
  steps: TimelineSteps;
}

const STEP_LABELS: { key: keyof TimelineSteps; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "escrowUpdated", label: "Escrow Updated" },
  { key: "completed", label: "Completed" },
];

export function TransactionTimeline({ visible, steps }: TransactionTimelineProps) {
  if (!visible) return null;

  return (
    <motion.div
      className="card"
      style={{ marginBottom: 16 }}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="card-title">tx_timeline</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STEP_LABELS.map(({ key, label }) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: steps[key] ? "var(--green)" : "var(--muted)",
              fontSize: 12,
            }}
          >
            <span style={{ width: 20 }}>
              {steps[key] ? "[✓]" : "[ ]"}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
