module freelance_platform::FreelancePlatform {

    use std::signer;
    use std::string::String;
    use std::vector;
    use AptosFramework::coin;
    use AptosFramework::aptos_coin::AptosCoin;
    use AptosFramework::timestamp;
    use AptosFramework::event;
    use AptosFramework::table::{Self, Table};

    // ============ Constants ============

    const JOB_STATUS_OPEN: u8 = 0;
    const JOB_STATUS_IN_PROGRESS: u8 = 1;
    const JOB_STATUS_COMPLETED: u8 = 2;
    const JOB_STATUS_CANCELLED: u8 = 3;

    const BID_STATUS_PENDING: u8 = 0;
    const BID_STATUS_ACCEPTED: u8 = 1;
    const BID_STATUS_REJECTED: u8 = 2;

    /// Seconds after acceptance before freelancer can claim via dispute (7 days).
    const DISPUTE_TIMEOUT_SECONDS: u64 = 604800;
    /// If no milestone released and no dispute claimed, client can refund after this (30 days).
    const INACTIVITY_REFUND_SECONDS: u64 = 2592000;
    /// Platform fee: 1% = 100 basis points.
    const PLATFORM_FEE_BPS: u64 = 100;
    const BPS_DENOMINATOR: u64 = 10000;

    const MAX_MILESTONES: u64 = 20;

    // ============ Errors ============

    const EPLATFORM_NOT_INITIALIZED: u64 = 1;
    const EJOB_NOT_FOUND: u64 = 2;
    const EBID_NOT_FOUND: u64 = 3;
    const ENOT_JOB_CLIENT: u64 = 4;
    const ENOT_FREELANCER: u64 = 5;
    const EINVALID_STATUS: u64 = 6;
    const EBID_ALREADY_ACCEPTED: u64 = 7;
    const EESCROW_NOT_FUNDED: u64 = 8;
    const EINSUFFICIENT_COINS: u64 = 9;
    const EALREADY_INITIALIZED: u64 = 10;
    const EEMPTY_TITLE_OR_DESCRIPTION: u64 = 11;
    const EZERO_BUDGET: u64 = 12;
    const EMILESTONE_INDEX: u64 = 13;
    const EMILESTONE_SUM_MISMATCH: u64 = 14;
    const ETOO_MANY_MILESTONES: u64 = 15;
    const EDISPUTE_TIMEOUT_NOT_REACHED: u64 = 16;
    const ENO_ESCROW_REMAINING: u64 = 17;
    const EINACTIVITY_REFUND_NOT_REACHED: u64 = 18;
    const EDEADLINE_NOT_REACHED: u64 = 19;
    const EPLATFORM_PAUSED: u64 = 20;
    const ENOT_PLATFORM_ADMIN: u64 = 21;

    // ============ Structs ============

    struct Job has store, drop {
        id: u64,
        client: address,
        title: String,
        description: String,
        budget: u64,
        milestone_amounts: vector<u64>,
        status: u8,
        accepted_bid_id: u64,
        released_milestones: u64,
        accepted_at: u64,
        created_at: u64,
        /// Unix timestamp; 0 = no deadline.
        deadline_ts: u64,
    }

    struct Bid has store, drop {
        id: u64,
        job_id: u64,
        freelancer: address,
        amount: u64,
        message: String,
        status: u8,
        created_at: u64,
    }

    struct PlatformState has key {
        job_counter: u64,
        bid_counter: u64,
        jobs: Table<u64, Job>,
        bids: Table<u64, Bid>,
        job_bids: Table<u64, vector<u64>>,
        escrow: Table<u64, coin::Coin<AptosCoin>>,
        paused: bool,
    }

    #[event]
    struct JobEvent has drop, store {
        job_id: u64,
        client: address,
        budget: u64,
        status: u8,
    }

    #[event]
    struct BidEvent has drop, store {
        bid_id: u64,
        job_id: u64,
        freelancer: address,
        amount: u64,
        status: u8,
    }

    #[event]
    struct MilestoneReleasedEvent has drop, store {
        job_id: u64,
        milestone_index: u64,
        amount: u64,
        platform_fee: u64,
    }

    #[event]
    struct DisputeClaimedEvent has drop, store {
        job_id: u64,
        freelancer: address,
        amount: u64,
        platform_fee: u64,
    }

    #[event]
    struct RefundEvent has drop, store {
        job_id: u64,
        to_client: address,
        amount: u64,
    }

    #[event]
    struct PauseEvent has drop, store {
        paused: bool,
    }

    // ============ Module init ============

    fun init_module(owner: &signer) {
        move_to(owner, PlatformState {
            job_counter: 0,
            bid_counter: 0,
            jobs: table::new(),
            bids: table::new(),
            job_bids: table::new(),
            escrow: table::new(),
            paused: false,
        });
    }

    // ============ Helpers ============

    fun sum_milestones(milestone_amounts: &vector<u64>): u64 {
        let i = 0u64;
        let total = 0u64;
        while (i < vector::length(milestone_amounts)) {
            total = total + *vector::borrow(milestone_amounts, i);
            i = i + 1;
        };
        total
    }

    fun platform_fee_for_amount(amount: u64): (u64, u64) {
        let fee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        (amount - fee, fee)
    }

    // ============ Entry / public functions ============

    /// Create a job with milestones. Optional deadline_ts (0 = no deadline).
    public entry fun create_job(
        client: &signer,
        title: String,
        description: String,
        milestone_amounts: vector<u64>,
        deadline_ts: u64,
    ) acquires PlatformState {
        assert!(!borrow_global<PlatformState>(@freelance_platform).paused, EPLATFORM_PAUSED);
        assert!(std::string::length(&title) > 0, EEMPTY_TITLE_OR_DESCRIPTION);
        assert!(std::string::length(&description) > 0, EEMPTY_TITLE_OR_DESCRIPTION);
        assert!(vector::length(&milestone_amounts) > 0, EZERO_BUDGET);
        assert!(vector::length(&milestone_amounts) <= MAX_MILESTONES, ETOO_MANY_MILESTONES);

        let budget = sum_milestones(&milestone_amounts);
        assert!(budget > 0, EZERO_BUDGET);

        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        state.job_counter = state.job_counter + 1;
        let job_id = state.job_counter;
        let now = timestamp::now_seconds();
        let job = Job {
            id: job_id,
            client: client_addr,
            title,
            description,
            budget,
            milestone_amounts,
            status: JOB_STATUS_OPEN,
            accepted_bid_id: 0,
            released_milestones: 0,
            accepted_at: 0,
            created_at: now,
            deadline_ts,
        };
        table::add(&mut state.jobs, job_id, job);
        table::add(&mut state.job_bids, job_id, vector::empty<u64>());
        event::emit(JobEvent {
            job_id,
            client: client_addr,
            budget,
            status: JOB_STATUS_OPEN,
        });
    }

    public entry fun place_bid(
        freelancer: &signer,
        job_id: u64,
        amount: u64,
        message: String,
    ) acquires PlatformState {
        assert!(!borrow_global<PlatformState>(@freelance_platform).paused, EPLATFORM_PAUSED);
        assert!(amount > 0, EZERO_BUDGET);
        let freelancer_addr = signer::address_of(freelancer);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.status == JOB_STATUS_OPEN, EINVALID_STATUS);
        state.bid_counter = state.bid_counter + 1;
        let bid_id = state.bid_counter;
        let now = timestamp::now_seconds();
        let bid = Bid {
            id: bid_id,
            job_id,
            freelancer: freelancer_addr,
            amount,
            message,
            status: BID_STATUS_PENDING,
            created_at: now,
        };
        table::add(&mut state.bids, bid_id, bid);
        let bid_ids = table::borrow_mut(&mut state.job_bids, job_id);
        vector::push_back(bid_ids, bid_id);
        event::emit(BidEvent {
            bid_id,
            job_id,
            freelancer: freelancer_addr,
            amount,
            status: BID_STATUS_PENDING,
        });
    }

    /// Client accepts a bid. Other pending bids for this job are auto-rejected.
    public entry fun accept_bid(
        client: &signer,
        job_id: u64,
        bid_id: u64,
    ) acquires PlatformState {
        assert!(!borrow_global<PlatformState>(@freelance_platform).paused, EPLATFORM_PAUSED);
        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        assert!(table::contains(&state.bids, bid_id), EBID_NOT_FOUND);

        let (accepted_bid_id, _, _) = {
            let job = table::borrow_mut(&mut state.jobs, job_id);
            assert!(job.client == client_addr, ENOT_JOB_CLIENT);
            assert!(job.status == JOB_STATUS_OPEN, EINVALID_STATUS);
            assert!(job.accepted_bid_id == 0, EBID_ALREADY_ACCEPTED);
            let bid = table::borrow_mut(&mut state.bids, bid_id);
            assert!(bid.job_id == job_id, EBID_NOT_FOUND);
            assert!(bid.status == BID_STATUS_PENDING, EINVALID_STATUS);
            job.accepted_bid_id = bid_id;
            job.status = JOB_STATUS_IN_PROGRESS;
            job.accepted_at = timestamp::now_seconds();
            bid.status = BID_STATUS_ACCEPTED;
            event::emit(JobEvent {
                job_id,
                client: client_addr,
                budget: job.budget,
                status: JOB_STATUS_IN_PROGRESS,
            });
            event::emit(BidEvent {
                bid_id,
                job_id,
                freelancer: bid.freelancer,
                amount: bid.amount,
                status: BID_STATUS_ACCEPTED,
            });
            (bid_id, bid.freelancer, bid.amount)
        };

        let job_bids_ref = table::borrow(&state.job_bids, job_id);
        let i = 0u64;
        let len = vector::length(job_bids_ref);
        while (i < len) {
            let other_id = *vector::borrow(job_bids_ref, i);
            if (other_id != accepted_bid_id) {
                let other_bid = table::borrow_mut(&mut state.bids, other_id);
                other_bid.status = BID_STATUS_REJECTED;
                event::emit(BidEvent {
                    bid_id: other_id,
                    job_id,
                    freelancer: other_bid.freelancer,
                    amount: other_bid.amount,
                    status: BID_STATUS_REJECTED,
                });
            };
            i = i + 1;
        };
    }

    /// Client funds escrow with full job amount (must equal accepted bid amount).
    public entry fun fund_escrow(
        client: &signer,
        job_id: u64,
        amount: u64,
    ) acquires PlatformState {
        assert!(!borrow_global<PlatformState>(@freelance_platform).paused, EPLATFORM_PAUSED);
        assert!(amount > 0, EZERO_BUDGET);
        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        let job = table::borrow(&state.jobs, job_id);
        assert!(job.client == client_addr, ENOT_JOB_CLIENT);
        assert!(job.status == JOB_STATUS_IN_PROGRESS, EINVALID_STATUS);
        let bid_id = job.accepted_bid_id;
        let bid = table::borrow(&state.bids, bid_id);
        assert!(amount == bid.amount, EINSUFFICIENT_COINS);
        assert!(!table::contains(&state.escrow, job_id), EALREADY_INITIALIZED);
        let coins = coin::withdraw<AptosCoin>(client, amount);
        table::add(&mut state.escrow, job_id, coins);
    }

    /// Client releases one milestone to the freelancer. 1% platform fee is deducted.
    public entry fun release_milestone(
        client: &signer,
        job_id: u64,
        milestone_index: u64,
    ) acquires PlatformState {
        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        assert!(table::contains(&state.escrow, job_id), EESCROW_NOT_FUNDED);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.client == client_addr, ENOT_JOB_CLIENT);
        assert!(job.status == JOB_STATUS_IN_PROGRESS, EINVALID_STATUS);
        assert!(milestone_index == job.released_milestones, EMILESTONE_INDEX);
        assert!(milestone_index < vector::length(&job.milestone_amounts), EMILESTONE_INDEX);

        let bid_id = job.accepted_bid_id;
        let bid = table::borrow(&state.bids, bid_id);
        let amount = *vector::borrow(&job.milestone_amounts, milestone_index);
        let (to_freelancer, fee) = platform_fee_for_amount(amount);

        let escrow_coin = table::borrow_mut(&mut state.escrow, job_id);
        let pay = coin::extract(escrow_coin, amount);
        if (fee > 0) {
            let freelancer_coin = coin::extract(&mut pay, to_freelancer);
            let fee_coin = coin::extract_all(&mut pay);
            coin::deposit(@freelance_platform, fee_coin);
            coin::deposit(bid.freelancer, freelancer_coin);
            coin::destroy_zero(pay);
        } else {
            coin::deposit(bid.freelancer, pay);
        };

        job.released_milestones = job.released_milestones + 1;
        if (job.released_milestones == vector::length(&job.milestone_amounts)) {
            job.status = JOB_STATUS_COMPLETED;
            event::emit(JobEvent {
                job_id,
                client: client_addr,
                budget: job.budget,
                status: JOB_STATUS_COMPLETED,
            });
        };
        event::emit(MilestoneReleasedEvent {
            job_id,
            milestone_index,
            amount: to_freelancer,
            platform_fee: fee,
        });
    }

    /// If client does not release after DISPUTE_TIMEOUT_SECONDS, freelancer can claim remaining escrow (with 1% fee).
    public entry fun claim_after_dispute(
        freelancer: &signer,
        job_id: u64,
    ) acquires PlatformState {
        let freelancer_addr = signer::address_of(freelancer);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        assert!(table::contains(&state.escrow, job_id), EESCROW_NOT_FUNDED);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.status == JOB_STATUS_IN_PROGRESS, EINVALID_STATUS);
        assert!(job.accepted_at > 0, EINVALID_STATUS);
        assert!(timestamp::now_seconds() >= job.accepted_at + DISPUTE_TIMEOUT_SECONDS, EDISPUTE_TIMEOUT_NOT_REACHED);
        let bid = table::borrow(&state.bids, job.accepted_bid_id);
        assert!(bid.freelancer == freelancer_addr, ENOT_FREELANCER);

        let remaining = table::remove(&mut state.escrow, job_id);
        let amount = coin::value(&remaining);
        assert!(amount > 0, ENO_ESCROW_REMAINING);
        let (to_freelancer, fee) = platform_fee_for_amount(amount);
        let fee_coin = coin::extract(&mut remaining, fee);
        let freelancer_coin = coin::extract_all(&mut remaining);
        coin::destroy_zero(remaining);
        coin::deposit(@freelance_platform, fee_coin);
        coin::deposit(bid.freelancer, freelancer_coin);
        job.status = JOB_STATUS_COMPLETED;
        event::emit(JobEvent {
            job_id,
            client: job.client,
            budget: job.budget,
            status: JOB_STATUS_COMPLETED,
        });
        event::emit(DisputeClaimedEvent {
            job_id,
            freelancer: freelancer_addr,
            amount: to_freelancer,
            platform_fee: fee,
        });
    }

    /// Client cancels an open job (no accepted bid yet).
    public entry fun cancel_job(
        client: &signer,
        job_id: u64,
    ) acquires PlatformState {
        assert!(!borrow_global<PlatformState>(@freelance_platform).paused, EPLATFORM_PAUSED);
        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.client == client_addr, ENOT_JOB_CLIENT);
        assert!(job.status == JOB_STATUS_OPEN, EINVALID_STATUS);
        job.status = JOB_STATUS_CANCELLED;
        event::emit(JobEvent {
            job_id,
            client: client_addr,
            budget: job.budget,
            status: JOB_STATUS_CANCELLED,
        });
    }

    // ============ Refund flows ============

    /// Both client and freelancer agree: return full escrow to client (no fee). Requires escrow funded.
    public entry fun mutual_refund(
        client: &signer,
        freelancer: &signer,
        job_id: u64,
    ) acquires PlatformState {
        let client_addr = signer::address_of(client);
        let freelancer_addr = signer::address_of(freelancer);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        assert!(table::contains(&state.escrow, job_id), EESCROW_NOT_FUNDED);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.client == client_addr, ENOT_JOB_CLIENT);
        assert!(job.status == JOB_STATUS_IN_PROGRESS, EINVALID_STATUS);
        let bid = table::borrow(&state.bids, job.accepted_bid_id);
        assert!(bid.freelancer == freelancer_addr, ENOT_FREELANCER);

        let coins = table::remove(&mut state.escrow, job_id);
        let amount = coin::value(&coins);
        coin::deposit(client_addr, coins);
        job.status = JOB_STATUS_CANCELLED;
        event::emit(JobEvent {
            job_id,
            client: client_addr,
            budget: job.budget,
            status: JOB_STATUS_CANCELLED,
        });
        event::emit(RefundEvent {
            job_id,
            to_client: client_addr,
            amount,
        });
    }

    /// If no milestone released and accepted_at + INACTIVITY_REFUND_SECONDS passed, client can take escrow back.
    public entry fun refund_after_inactivity(
        client: &signer,
        job_id: u64,
    ) acquires PlatformState {
        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        assert!(table::contains(&state.escrow, job_id), EESCROW_NOT_FUNDED);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.client == client_addr, ENOT_JOB_CLIENT);
        assert!(job.status == JOB_STATUS_IN_PROGRESS, EINVALID_STATUS);
        assert!(job.released_milestones == 0, EINVALID_STATUS);
        assert!(job.accepted_at > 0, EINVALID_STATUS);
        assert!(timestamp::now_seconds() >= job.accepted_at + INACTIVITY_REFUND_SECONDS, EINACTIVITY_REFUND_NOT_REACHED);

        let coins = table::remove(&mut state.escrow, job_id);
        let amount = coin::value(&coins);
        coin::deposit(client_addr, coins);
        job.status = JOB_STATUS_CANCELLED;
        event::emit(JobEvent {
            job_id,
            client: client_addr,
            budget: job.budget,
            status: JOB_STATUS_CANCELLED,
        });
        event::emit(RefundEvent {
            job_id,
            to_client: client_addr,
            amount,
        });
    }

    /// If job has deadline (deadline_ts > 0) and deadline passed with no milestone released, client can refund.
    public entry fun refund_after_deadline(
        client: &signer,
        job_id: u64,
    ) acquires PlatformState {
        let client_addr = signer::address_of(client);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        assert!(table::contains(&state.jobs, job_id), EJOB_NOT_FOUND);
        assert!(table::contains(&state.escrow, job_id), EESCROW_NOT_FUNDED);
        let job = table::borrow_mut(&mut state.jobs, job_id);
        assert!(job.client == client_addr, ENOT_JOB_CLIENT);
        assert!(job.status == JOB_STATUS_IN_PROGRESS, EINVALID_STATUS);
        assert!(job.deadline_ts > 0, EDEADLINE_NOT_REACHED);
        assert!(timestamp::now_seconds() >= job.deadline_ts, EDEADLINE_NOT_REACHED);
        assert!(job.released_milestones == 0, EINVALID_STATUS);

        let coins = table::remove(&mut state.escrow, job_id);
        let amount = coin::value(&coins);
        coin::deposit(client_addr, coins);
        job.status = JOB_STATUS_CANCELLED;
        event::emit(JobEvent {
            job_id,
            client: client_addr,
            budget: job.budget,
            status: JOB_STATUS_CANCELLED,
        });
        event::emit(RefundEvent {
            job_id,
            to_client: client_addr,
            amount,
        });
    }

    // ============ Admin ============

    /// Pause new jobs/bids/accept/fund; release/dispute/refund still work. Deployer only.
    public entry fun set_paused(admin: &signer, paused: bool) acquires PlatformState {
        assert!(signer::address_of(admin) == @freelance_platform, ENOT_PLATFORM_ADMIN);
        let state = borrow_global_mut<PlatformState>(@freelance_platform);
        state.paused = paused;
        event::emit(PauseEvent { paused });
    }

    /// Withdraw platform fees to address. Deployer only.
    public entry fun withdraw_platform_fees(admin: &signer, to: address, amount: u64) {
        assert!(signer::address_of(admin) == @freelance_platform, ENOT_PLATFORM_ADMIN);
        assert!(amount > 0, EZERO_BUDGET);
        let coins = coin::withdraw<AptosCoin>(admin, amount);
        coin::deposit(to, coins);
    }

    // ============ View functions ============

    #[view]
    public fun get_job_client(job_id: u64): address acquires PlatformState {
        *&table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).client
    }

    #[view]
    public fun get_job_budget(job_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).budget
    }

    #[view]
    public fun get_job_status(job_id: u64): u8 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).status
    }

    #[view]
    public fun get_job_accepted_bid_id(job_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).accepted_bid_id
    }

    #[view]
    public fun get_job_released_milestones(job_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).released_milestones
    }

    #[view]
    public fun get_job_accepted_at(job_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).accepted_at
    }

    #[view]
    public fun get_job_created_at(job_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).created_at
    }

    #[view]
    public fun get_job_deadline_ts(job_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).deadline_ts
    }

    #[view]
    public fun get_job_milestone_count(job_id: u64): u64 acquires PlatformState {
        vector::length(&table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).milestone_amounts)
    }

    #[view]
    public fun get_job_milestone_amount(job_id: u64, index: u64): u64 acquires PlatformState {
        *vector::borrow(&table::borrow(&borrow_global<PlatformState>(@freelance_platform).jobs, job_id).milestone_amounts, index)
    }

    #[view]
    public fun get_bid_job_id(bid_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).bids, bid_id).job_id
    }

    #[view]
    public fun get_bid_freelancer(bid_id: u64): address acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).bids, bid_id).freelancer
    }

    #[view]
    public fun get_bid_amount(bid_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).bids, bid_id).amount
    }

    #[view]
    public fun get_bid_status(bid_id: u64): u8 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).bids, bid_id).status
    }

    #[view]
    public fun get_bid_created_at(bid_id: u64): u64 acquires PlatformState {
        table::borrow(&borrow_global<PlatformState>(@freelance_platform).bids, bid_id).created_at
    }

    #[view]
    public fun get_job_bid_ids(job_id: u64): vector<u64> acquires PlatformState {
        let state = borrow_global<PlatformState>(@freelance_platform);
        let src = table::borrow(&state.job_bids, job_id);
        let len = vector::length(src);
        let i = 0u64;
        let result = vector::empty<u64>();
        while (i < len) {
            vector::push_back(&mut result, *vector::borrow(src, i));
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_escrow_amount(job_id: u64): u64 acquires PlatformState {
        let state = borrow_global<PlatformState>(@freelance_platform);
        if (table::contains(&state.escrow, job_id)) {
            coin::value(table::borrow(&state.escrow, job_id))
        } else {
            0
        }
    }

    #[view]
    public fun is_paused(): bool acquires PlatformState {
        borrow_global<PlatformState>(@freelance_platform).paused
    }

    #[view]
    public fun get_job_counter(): u64 acquires PlatformState {
        borrow_global<PlatformState>(@freelance_platform).job_counter
    }

    #[view]
    public fun get_bid_counter(): u64 acquires PlatformState {
        borrow_global<PlatformState>(@freelance_platform).bid_counter
    }
}
