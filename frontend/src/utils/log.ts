export type ErrorCategory = "error_wallet" | "error_vm" | "error_network" | "error";

export function getErrorCategory(e: unknown): ErrorCategory {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject/i.test(msg)) return "error_wallet";
  if (/Move abort|VM|execution|EINVALID|ENOT_|EESCROW|EINSUFFICIENT/i.test(msg))
    return "error_vm";
  if (/timeout|fetch|network|ECONNREFUSED/i.test(msg)) return "error_network";
  return "error";
}

export function formatTxError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject/i.test(msg)) return "> wallet signature rejected";
  if (/Move abort|VM|execution/i.test(msg)) return `> vm error: ${msg.slice(0, 80)}${msg.length > 80 ? "…" : ""}`;
  if (/timeout|fetch|network/i.test(msg)) return "> network error: request failed";
  return `> error: ${msg}`;
}
