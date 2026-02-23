import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getJobCounter,
  getJobBudget,
  getJobStatus,
  getJobClient,
  getJobMilestoneCount,
  getJobReleasedMilestones,
  getEscrowAmount,
  octasToApt,
  jobStatusLabel,
  JOB_STATUS,
} from "../aptos";

export interface JobSummary {
  jobId: number;
  client: string;
  budget: number;
  status: number;
  milestoneCount: number;
  releasedMilestones: number;
  escrowAmount: number;
}

export function JobList({
  refreshTrigger,
  onSelectJob,
  selectedJobId,
}: {
  refreshTrigger: number;
  onSelectJob: (jobId: number) => void;
  selectedJobId: number | null;
}) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const count = await getJobCounter();
        if (count === 0) {
          setJobs([]);
          return;
        }
        const list: JobSummary[] = [];
        for (let id = 1; id <= count; id++) {
          try {
            const [client, budget, status, milestoneCount, released, escrow] =
              await Promise.all([
                getJobClient(id),
                getJobBudget(id),
                getJobStatus(id),
                getJobMilestoneCount(id),
                getJobReleasedMilestones(id),
                getEscrowAmount(id),
              ]);
            list.push({
              jobId: id,
              client,
              budget,
              status,
              milestoneCount,
              releasedMilestones: released,
              escrowAmount: escrow,
            });
          } catch {
            // job may not exist if ids are sparse
          }
        }
        if (!cancelled) setJobs(list.reverse());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <motion.div
        className="card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="card-title">2. job_list</div>
        <div style={{ color: "var(--muted)" }}>loading...</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-title">2. job_list</div>
      {jobs.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No jobs yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j) => (
            <motion.div
              key={j.jobId}
              style={{
                border: "1px solid var(--border)",
                padding: 12,
                borderRadius: 4,
                cursor: "pointer",
                background:
                  selectedJobId === j.jobId ? "rgba(0,255,136,0.08)" : "transparent",
              }}
              onClick={() => onSelectJob(j.jobId)}
              whileHover={{ borderColor: "var(--green)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ color: "var(--green)" }}>Job #{j.jobId}</span>
                <span className={`badge badge-${j.status === JOB_STATUS.OPEN ? "open" : j.status === JOB_STATUS.IN_PROGRESS ? "progress" : j.status === JOB_STATUS.COMPLETED ? "completed" : "cancelled"}`}>
                  {jobStatusLabel(j.status)}
                </span>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                client: {j.client.slice(0, 8)}...{j.client.slice(-4)}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                budget: {octasToApt(j.budget)} APT · escrow: {octasToApt(j.escrowAmount)} APT
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Milestones: {j.releasedMilestones}/{j.milestoneCount} released
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
