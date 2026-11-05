import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ExpiryEntry, LedgerTotal } from "../../rules/loyalty/ledger.types"
import type { RewardEdit } from "../../rules/loyalty/reward.types"
import type {
    CampaignCreated,
    CampaignRequest,
    CampaignRow,
    DecisionItem,
    LedgerPost,
    LedgerRow,
    MemberListRow,
    MemberPatch,
    MemberRow,
    ProgramRow,
    ProgramSave,
    RewardRemoval,
    RewardRow,
    StoreResult,
    Synced,
    Verdict,
} from "./loyalty.types"

/** The customers as the Loyalty reads and actions use them; the host swaps it for the entity engine port in one place. */
export interface MemberStore {
    /** The customer, or null when the workspace has none with that id. */
    readonly get: (id: string) => Promise<MemberRow | null>
    /** Writes the patch when the customer is still at the version `expected`; a stale version is a conflict. */
    readonly update: (id: string, expected: string, patch: MemberPatch) => Promise<StoreResult<MemberRow>>
    /** Every customer with the balance the ledger gives; the host bounds the answer. */
    readonly all: () => Promise<ReadonlyArray<MemberRow>>
    /** The customer of a normalised phone, created with the name when the phone is new. */
    readonly ensureByPhone: (phone: string, name: string) => Promise<MemberRow>
    /** Makes a customer of every lead that has a phone or an email and links the leads and their chats to them. */
    readonly sync: () => Promise<Synced>
    /** How many of the given customers have a chat staff do not handle, so a promotion can reach them. */
    readonly reachable: (ids: ReadonlyArray<string>) => Promise<number>
}

/** The append-only points ledger. */
export interface LedgerStore {
    /** The newest entries of a customer, newest first, at most `limit`. */
    readonly timeline: (customerId: string, limit: number) => Promise<ReadonlyArray<LedgerRow>>
    /** The part of every entry of a customer that decides what is still unspent. */
    readonly expiryEntries: (customerId: string) => Promise<ReadonlyArray<ExpiryEntry>>
    /** How many times a customer redeemed each reward, by reward id. */
    readonly redeemedCounts: (customerId: string) => Promise<Readonly<Record<string, number>>>
    /** What each kind of entry came to since an instant, ISO 8601. */
    readonly totalsSince: (sinceIso: string) => Promise<ReadonlyArray<LedgerTotal>>
    /** Writes the entry; the id of the entry, or null when its `ref` was posted before. */
    readonly post: (entry: LedgerPost) => Promise<string | null>
    /** Whether an entry with the `ref` was posted before. */
    readonly hasRef: (ref: string) => Promise<boolean>
}

/** The reward catalogue. */
export interface RewardStore {
    /** The rewards, newest first; only the active ones when `activeOnly`. */
    readonly list: (activeOnly: boolean) => Promise<ReadonlyArray<RewardRow>>
    /** The reward, or null when the workspace has none with that id. */
    readonly get: (id: string) => Promise<RewardRow | null>
    /** Creates the reward, or changes the one the edit names; a name taken by another reward gets a suffixed key. */
    readonly save: (edit: RewardEdit) => Promise<StoreResult<RewardRow>>
    /** Deletes a reward nobody redeemed; one with history is paused instead. */
    readonly remove: (id: string) => Promise<RewardRemoval>
    /** Takes one unit from the stock of a reward that has stock. */
    readonly takeOne: (id: string) => Promise<void>
    /** Adds the rewards whose key the catalogue lacks; how many were added. */
    readonly addMissing: (edits: ReadonlyArray<RewardEdit>) => Promise<number>
}

/** The programme of the workspace. */
export interface ProgramStore {
    /** The saved programme, or null before the first save. */
    readonly get: () => Promise<ProgramRow | null>
    /** Creates or changes the programme. */
    readonly save: (save: ProgramSave) => Promise<ProgramRow>
}

/** The campaigns of the owner's promotions. */
export interface CampaignStore {
    /** The newest campaigns, at most `limit`. */
    readonly list: (limit: number) => Promise<ReadonlyArray<CampaignRow>>
    /** How many promotions were sent since an instant, ISO 8601. */
    readonly sentSince: (sinceIso: string) => Promise<number>
    /** Writes a campaign as a draft; nothing is sent from here. */
    readonly create: (request: CampaignRequest) => Promise<CampaignCreated>
}

/** The decisions about loyalty that wait for a person. */
export interface DecisionStore {
    /** The waiting decisions, oldest first, at most `limit`. */
    readonly waiting: (limit: number) => Promise<ReadonlyArray<DecisionItem>>
    /** Gives a decision its verdict; the decision as decided. */
    readonly decide: (id: string, verdict: Verdict) => Promise<StoreResult<DecisionItem>>
}

/** The port the members list runs on. */
export const loyaltyMembersList: PortDefinition<ListSource<MemberListRow>> =
    definePort<ListSource<MemberListRow>>("loyalty.members-list")

/** The port of the customers. */
export const loyaltyMembers: PortDefinition<MemberStore> = definePort<MemberStore>("loyalty.members")

/** The port of the points ledger. */
export const loyaltyLedger: PortDefinition<LedgerStore> = definePort<LedgerStore>("loyalty.ledger")

/** The port of the reward catalogue. */
export const loyaltyRewards: PortDefinition<RewardStore> = definePort<RewardStore>("loyalty.rewards")

/** The port of the programme. */
export const loyaltyProgram: PortDefinition<ProgramStore> = definePort<ProgramStore>("loyalty.program")

/** The port of the campaigns. */
export const loyaltyCampaigns: PortDefinition<CampaignStore> = definePort<CampaignStore>("loyalty.campaigns")

/** The port of the waiting decisions. */
export const loyaltyDecisions: PortDefinition<DecisionStore> = definePort<DecisionStore>("loyalty.decisions")
