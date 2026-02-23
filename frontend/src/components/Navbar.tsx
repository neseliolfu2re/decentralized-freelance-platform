import { useState, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const { connect, disconnect, account, wallets } = useWallet();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = () => {
    const petra = wallets.find((w) => w.name === "Petra");
    if (petra) connect(petra.name);
    else if (wallets[0]) connect(wallets[0].name);
  };

  const addr = account?.address != null ? String(account.address) : "";
  const shortAddress = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const handleCopy = useCallback(() => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [addr]);

  return (
    <motion.header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: "var(--green)", fontWeight: 600 }}>
          freelance_escrow
        </span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          Network: Testnet
        </span>
      </div>
      <div>
        {addr ? (
          <div
            style={{ position: "relative", display: "inline-block" }}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
          >
            <span
              style={{
                color: "var(--muted)",
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 8px",
                border: "1px solid transparent",
                borderRadius: 2,
              }}
            >
              {shortAddress}
            </span>
            <AnimatePresence>
              {tooltipOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 6,
                    background: "#111",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: "10px 12px",
                    minWidth: 320,
                    zIndex: 100,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 10,
                      marginBottom: 4,
                    }}
                  >
                    ADDRESS
                  </div>
                  <div
                    style={{
                      color: "var(--text)",
                      fontSize: 11,
                      wordBreak: "break-all",
                      marginBottom: 8,
                    }}
                  >
                    {addr}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "4px 10px", fontSize: 11 }}
                    onClick={handleCopy}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}
        {addr ? (
          <button
            className="btn"
            style={{ marginLeft: 8 }}
            onClick={() => disconnect()}
          >
            disconnect
          </button>
        ) : (
          <button className="btn" onClick={handleConnect}>
            connect_wallet
          </button>
        )}
      </div>
    </motion.header>
  );
}
