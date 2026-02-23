import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

export const MODULE_ADDRESS =
  "0xf699388d677a5e37bf55a1d99db52d108ed32284f25f60de5d97d2ec23d2b5a4";
export const MODULE_NAME = "FreelancePlatform";

const config = new AptosConfig({ network: Network.TESTNET });
export const aptos = new Aptos(config);

async function view<T>(functionName: string, args: (string | number)[] = []): Promise<T> {
  const result = await aptos.view({
    payload: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::${functionName}`,
      functionArguments: args,
    } as Parameters<Aptos["view"]>[0]["payload"],
  });
  return result as T;
}

export async function getJobCounter(): Promise<number> {
  const result = await view<[number]>("get_job_counter");
  return Number(result[0]);
}

export async function getJobClient(jobId: number): Promise<string> {
  const result = await view<[string]>("get_job_client", [jobId]);
  return String(result[0]);
}

export async function getJobBudget(jobId: number): Promise<number> {
  const result = await view<[number]>("get_job_budget", [jobId]);
  return Number(result[0]);
}

export async function getJobStatus(jobId: number): Promise<number> {
  const result = await view<[number]>("get_job_status", [jobId]);
  return Number(result[0]);
}

export async function getJobAcceptedBidId(jobId: number): Promise<number> {
  const result = await view<[number]>("get_job_accepted_bid_id", [jobId]);
  return Number(result[0]);
}

export async function getJobReleasedMilestones(jobId: number): Promise<number> {
  const result = await view<[number]>("get_job_released_milestones", [jobId]);
  return Number(result[0]);
}

export async function getJobMilestoneCount(jobId: number): Promise<number> {
  const result = await view<[number]>("get_job_milestone_count", [jobId]);
  return Number(result[0]);
}

export async function getJobMilestoneAmount(
  jobId: number,
  index: number
): Promise<number> {
  const result = await view<[number]>("get_job_milestone_amount", [jobId, index]);
  return Number(result[0]);
}

export async function getJobBidIds(jobId: number): Promise<number[]> {
  const result = await view<[number[]]>("get_job_bid_ids", [jobId]);
  return (result[0] as number[]) || [];
}

export async function getBidAmount(bidId: number): Promise<number> {
  const result = await view<[number]>("get_bid_amount", [bidId]);
  return Number(result[0]);
}

export async function getBidFreelancer(bidId: number): Promise<string> {
  const result = await view<[string]>("get_bid_freelancer", [bidId]);
  return String(result[0]);
}

export async function getBidStatus(bidId: number): Promise<number> {
  const result = await view<[number]>("get_bid_status", [bidId]);
  return Number(result[0]);
}

export async function getEscrowAmount(jobId: number): Promise<number> {
  const result = await view<[number]>("get_escrow_amount", [jobId]);
  return Number(result[0]);
}

export const OCTAS_PER_APT = 100_000_000;

export function octasToApt(octas: number): string {
  return (octas / OCTAS_PER_APT).toFixed(2);
}

export const JOB_STATUS = {
  OPEN: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  CANCELLED: 3,
} as const;

export function jobStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return "OPEN";
    case 1:
      return "IN_PROGRESS";
    case 2:
      return "COMPLETED";
    case 3:
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}
