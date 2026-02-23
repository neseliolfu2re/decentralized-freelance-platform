import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { motion } from "framer-motion";

export function Navbar() {
  const { connect, disconnect, account, connected, wallets } = useWallet();

  const handleConnect = () => {
    const petra = wallets.find((w) => w.name === "Petra");
    if (petra) connect(petra.name);
    else if (wallets[0]) connect(wallets[0].name);
  };

  const addr = account?.address != null ? String(account.address) : "";
  const shortAddress = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

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
        {connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              {shortAddress}
            </span>
            <button className="btn" onClick={() => disconnect()}>
              disconnect
            </button>
          </div>
        ) : (
          <button className="btn" onClick={handleConnect}>
            connect_wallet
          </button>
        )}
      </div>
    </motion.header>
  );
}
