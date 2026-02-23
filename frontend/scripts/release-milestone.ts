// release_milestone tx. APTOS_PRIVATE_KEY env, args: job_id milestone_index

import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";

const MODULE_ADDRESS =
  "0xf699388d677a5e37bf55a1d99db52d108ed32284f25f60de5d97d2ec23d2b5a4";
const MODULE_NAME = "FreelancePlatform";

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/i, "");
  if (h.length % 2 !== 0) throw new Error("Invalid hex length");
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function main() {
  const jobIdStr = process.argv[2];
  const milestoneIndexStr = process.argv[3];
  const privateKeyHex = process.env.APTOS_PRIVATE_KEY;

  if (!jobIdStr || !milestoneIndexStr) {
    console.error("Usage: npx tsx scripts/release-milestone.ts <job_id> <milestone_index>");
    console.error("Example: npx tsx scripts/release-milestone.ts 1 0");
    process.exit(1);
  }

  if (!privateKeyHex) {
    console.error("Set APTOS_PRIVATE_KEY (client's private key, hex).");
    process.exit(1);
  }

  const jobId = Number(jobIdStr);
  const milestoneIndex = Number(milestoneIndexStr);
  if (Number.isNaN(jobId) || Number.isNaN(milestoneIndex) || jobId < 0 || milestoneIndex < 0) {
    console.error("job_id and milestone_index must be non-negative numbers.");
    process.exit(1);
  }

  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  const privateKeyBytes = hexToBytes(privateKeyHex);
  const privateKey = new Ed25519PrivateKey(privateKeyBytes);
  const account = Account.fromPrivateKey({ privateKey });

  console.log("Client address:", account.accountAddress.toString());
  console.log("Job ID:", jobId, "| Milestone index:", milestoneIndex);

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::release_milestone`,
      functionArguments: [jobId, milestoneIndex],
    },
  });

  const committed = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  console.log("Submitted tx hash:", committed.hash);
  const executed = await aptos.waitForTransaction({ transactionHash: committed.hash });
  console.log("Confirmed:", executed.hash);
  console.log("Explorer: https://explorer.aptoslabs.com/txn/" + executed.hash + "?network=testnet");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
