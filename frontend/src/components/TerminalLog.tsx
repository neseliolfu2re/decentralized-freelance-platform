import { motion, AnimatePresence } from "framer-motion";

export type LogType = "default" | "success" | "error" | "tx";

export interface LogLine {
  id: number;
  text: string;
  type?: LogType;
}

interface TerminalLogProps {
  lines: LogLine[];
  title?: string;
}

export function TerminalLog({ lines, title = "> system_log" }: TerminalLogProps) {
  return (
    <motion.div
      className="terminal-log"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-title" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <AnimatePresence initial={false}>
        {lines.length === 0 ? (
          <div className="log-line" style={{ color: "var(--muted)" }}>
            &nbsp;
          </div>
        ) : (
          lines.map((line) => (
            <motion.div
              key={line.id}
              className={`log-line ${line.type || ""}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {line.text}
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </motion.div>
  );
}
