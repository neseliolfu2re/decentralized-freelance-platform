# Decentralized Freelance Platform

Trust-minimized freelance escrow on **Aptos (Move)**: milestone-based payments, on-chain APT escrow, dispute timeout, refund flows, and a minimal web UI. No backend—everything is on-chain.

---

## 1. Problem Statement

Traditional freelance platforms centralize funds and trust: payouts depend on platform policy, chargebacks and payment holds are common, and disputes require a central arbiter. Clients and freelancers are exposed to counterparty risk and platform dependency.

**This project** provides:

- **Escrow** – Client funds are locked on-chain until milestones are released or a time-bound rule applies. No single party can unilaterally withdraw.
- **Milestone-based release** – Payments are released step-by-step (e.g. 50% on delivery, 50% on approval), reducing exposure for both sides.
- **Deterministic dispute** – After 7 days without a release, the freelancer can claim the remaining escrow (with a small fee). No arbitrators or oracles.
- **Refund paths** – Mutual agreement, 30-day inactivity, or deadline-based refunds give clients and freelancers clear exit options.

The goal is **trust-minimized** freelance work: same roles (client, freelancer, platform fee), but enforcement and custody are on the blockchain instead of a central server.

---

## 2. Architecture

### 2.1 High-level

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User (Browser)                                                          │
│  ┌─────────────────────┐     ┌──────────────────┐                       │
│  │  React (Vite) UI     │────▶│  Petra Wallet     │                       │
│  │  Minimal Hacker UI   │     │  (Aptos Testnet)  │                       │
│  └──────────┬──────────┘     └────────┬─────────┘                       │
└─────────────┼─────────────────────────┼──────────────────────────────────┘
              │                         │
              │  Aptos TS SDK           │  signAndSubmitTransaction
              │  (view + submit)        │
              ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Aptos Testnet                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Module: 0xf699...::FreelancePlatform                                │ │
│  │  • PlatformState (jobs, bids, job_bids, escrow, paused)              │ │
│  │  • Escrow: Coin<AptosCoin> per job                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Frontend** – React (Vite), Aptos TS SDK, Petra wallet adapter. Single-page MVP; no backend.
- **Contract** – Single Move module at `@freelance_platform`. All state in one resource; escrow in a table of `Coin<AptosCoin>`.

### 2.2 Flow (client / freelancer / contract)

```
Client                    Contract                     Freelancer
  |                          |                              |
  |--- create_job ---------->|                              |
  |                          |<-------- place_bid ----------|
  |--- accept_bid ---------->|  (other bids auto-rejected)  |
  |--- fund_escrow --------->|                              |
  |--- release_milestone ---->|---- deposit (minus 1%) ----->|
  |   (repeat per milestone)  |                              |
  |                          |     [or after 7 days]        |
  |                          |<------- claim_after_dispute -|
  |                          |---- deposit (minus 1%) ------>|
  |--- mutual_refund ------->|  (client + freelancer sign)  |
  |   or refund_after_*       |---- deposit to client ------->|
```

### 2.3 Job state machine

```
    OPEN ──(accept_bid)──▶ IN_PROGRESS ──(release all / dispute / refund)──▶ COMPLETED
      │                          │
      │                          └─────────────────────────────────────────▶ CANCELLED
      │                                    (mutual_refund / inactivity / deadline)
      └──(cancel_job)──▶ CANCELLED
```

### 2.4 Contract state (summary)

| Concept | Implementation |
|--------|-----------------|
| Jobs | `Table<u64, Job>` (id → Job with client, title, description, budget, milestone_amounts, status, accepted_bid_id, released_milestones, accepted_at, created_at, deadline_ts) |
| Bids | `Table<u64, Bid>` (id → Bid with job_id, freelancer, amount, message, status) |
| Job → bid IDs | `Table<u64, vector<u64>>` (job_id → list of bid_ids) |
| Escrow | `Table<u64, Coin<AptosCoin>>` (job_id → coin balance) |
| Platform | `PlatformState` at `@freelance_platform`: counters, tables above, `paused` flag |

---

## 3. Security Considerations

### 3.1 Threat model

- **Reentrancy** – Not applicable: Move execution is single-threaded; no callback-style reentrant calls. Escrow updates are in-place.
- **Double-spend** – Escrow is one coin per job; `release_milestone` and `claim_after_dispute` deduct or remove that coin. Same funds cannot be released twice.
- **Access control** – Enforced via `signer`: only job `client` can accept, fund, release, cancel, refund; only accepted bid’s `freelancer` can call `claim_after_dispute`; only `@freelance_platform` can `set_paused` and `withdraw_platform_fees`.
- **Pause** – Only *new* engagements (create_job, place_bid, accept_bid, fund_escrow, cancel_job) are disabled. Release, dispute, and all refund flows stay enabled so users can always move funds out.

### 3.2 Invariants (for integrators / auditors)

- Escrow balance ≥ sum of unreleased milestone amounts after `fund_escrow`.
- `budget == sum(milestone_amounts)`; milestones released in order; `released_milestones` ≤ milestone count.
- Exactly one accepted bid per job; escrow row exists only after `fund_escrow`.
- Platform fees only from milestone releases and dispute claims (1% each).

### 3.3 Edge cases

- **Dispute vs refund** – Freelancer has 7 days to call `claim_after_dispute`; after 30 days with no release, client can use `refund_after_inactivity`. If the job has a deadline and it passed with no release, client can use `refund_after_deadline`.
- **Cancel** – Only open jobs (no accepted bid) can be cancelled by the client.

---

## 4. Attack Tests Summary

The following attacks were run on **Aptos Testnet**; the contract rejected them as intended.

| Attack | Expected | Result |
|--------|----------|--------|
| **Re-release same milestone** | Reject | `EINVALID_STATUS` – Job already COMPLETED; cannot release milestone again. |
| **Different user calls release_milestone** | Reject | `ENOT_JOB_CLIENT` – Only the job’s client can release milestones. |
| **Release without funding escrow** | Reject | `EESCROW_NOT_FUNDED` – Job had accepted bid but no `fund_escrow`; release path requires escrow entry. |

Conclusion: the module enforces client-only release, sequential milestones, and funded escrow before any payout. No extra backend or off-chain guard is required for these properties.

---

## 5. Contract Design Notes

- **Why Move** – Resource model and linear types prevent double-spend and accidental duplication of escrow. No dynamic dispatch or reentrancy; easier to reason about and audit.
- **Single module** – One `PlatformState` at one address. Simpler state, no cross-module calls, smaller attack surface.
- **Milestone-based escrow** – Limits exposure to the next milestone; client can stop after a bad delivery; freelancer gets paid incrementally.
- **7-day dispute window** – Fixed delay instead of arbitration. No oracles or jurors; freelancer can claim remaining escrow if client does not release, avoiding deadlock.
- **1% fee (100 bps)** – Taken on each milestone release and on dispute claim. Aligns platform revenue with actual delivery.
- **No upgrade hook** – Deployed module is immutable; users rely on a fixed contract, not admin-upgradable logic.
- **Pause** – Admin can disable new jobs/bids/accept/fund_escrow only. All exit paths (release, dispute, refunds) remain available so funds are never stuck.

---

## 6. Features (reference)

- **Jobs** – Title, description, list of milestone amounts, optional deadline. Budget = sum of milestones.
- **Bids** – Freelancer submits amount and message; client accepts one bid (others auto-rejected).
- **Escrow** – Client funds full job amount in APT; held in contract until release or refund.
- **Release** – Client releases one milestone at a time; 1% platform fee per release; freelancer receives the rest.
- **Dispute** – After 7 days, freelancer can call `claim_after_dispute` for remaining escrow (minus 1%).
- **Refunds** – Mutual (both sign), inactivity (30 days, no release), deadline (job had deadline and it passed with no release).
- **Cancel** – Client can cancel an open job (no accepted bid).
- **Admin** – Pause new activity; withdraw accumulated platform fees to an address.

---

## 7. Entry and view functions

| Entry | Who | Description |
|-------|-----|-------------|
| `create_job` | Client | Create job (title, description, milestone_amounts, deadline_ts; 0 = no deadline). |
| `place_bid` | Freelancer | Place bid (amount, message) on a job. |
| `accept_bid` | Client | Accept one bid; others for that job rejected. |
| `fund_escrow` | Client | Fund escrow with full job amount (APT). |
| `release_milestone` | Client | Release one milestone (1% fee to platform). |
| `claim_after_dispute` | Freelancer | After 7 days, claim remaining escrow (1% fee). |
| `cancel_job` | Client | Cancel open job. |
| `mutual_refund` | Client + Freelancer | Both sign; full escrow returned to client. |
| `refund_after_inactivity` | Client | After 30 days with no release, client takes escrow. |
| `refund_after_deadline` | Client | If deadline set and passed with no release, client refunds. |
| `set_paused` | Admin | Pause/unpause new jobs, bids, accepts, fund_escrow. |
| `withdraw_platform_fees` | Admin | Withdraw collected APT to an address. |

Views (for indexers/frontends): `get_job_*`, `get_bid_*`, `get_job_bid_ids`, `get_escrow_amount`, `is_paused`, `get_job_counter`, `get_bid_counter`. See module source for full list.

---

## 8. Build, test, deploy

**Compile (replace with your deploy address):**

```bash
aptos move compile --named-addresses freelance_platform=0xYOUR_ADDRESS
```

**Run tests:**

```bash
aptos move test --named-addresses freelance_platform=0x123
```

**Publish (Testnet example, after funding the account):**

```bash
aptos move publish --named-addresses freelance_platform=0xYOUR_ADDRESS --profile testnet --assume-yes --max-gas 500000
```

**Frontend (React + Petra, Aptos Testnet):**

```bash
cd frontend && npm install && npm run dev
```

Set Root Directory to `frontend` when deploying the web app (e.g. Vercel).

### Deterministic build

Pin `AptosFramework` to a specific commit in `Move.toml` for production:

```toml
AptosFramework = { git = "https://github.com/aptos-labs/aptos-framework.git", subdir = "aptos-framework", rev = "<commit-hash>" }
```

---

## License

Apache-2.0
