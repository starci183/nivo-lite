import { redeemKeyOf } from "../../../rules/loyalty/redeem"
import type { LedgerTotal } from "../../../rules/loyalty/ledger.types"
import { computeFigures, computeStats } from "../../../rules/loyalty/stats"
import type { DecisionQueueView } from "../../../views/views.types"
import { WAITING_SHOWN } from "../constants"
import {
    campaignViewOf,
    decisionQueueOf,
    ledgerViewOf,
    memberDetailOf,
    memberListRowOf,
    programViewOf,
    rewardViewOf,
    tierRowsOf,
    waitingRegionOf,
} from "../mappers"
import type { ModuleFixtures } from "../../module-fixtures"
import {
    MEMBER_GOLD,
    REWARD_VOUCHER,
    SAMPLE_CAMPAIGNS,
    SAMPLE_DECISIONS,
    SAMPLE_ENTRIES,
    SAMPLE_MEMBERS,
    SAMPLE_NOW,
    SAMPLE_PROGRAM,
    SAMPLE_REWARDS,
} from "./loyalty.data"

const NOW_MS = Date.parse(SAMPLE_NOW)
const CONFIG = SAMPLE_PROGRAM.config
const FIRST = MEMBER_GOLD
const FIRST_REWARD = REWARD_VOUCHER

const TOTALS: ReadonlyArray<LedgerTotal> = [
    { kind: "earn", entries: 2, points: 2120, amountVnd: 1_520_000 },
    { kind: "redeem", entries: 1, points: -500, amountVnd: 50_000 },
    { kind: "expire", entries: 0, points: 0, amountVnd: 0 },
    { kind: "adjust", entries: 1, points: -170, amountVnd: 0 },
]

const STATS = computeStats(SAMPLE_MEMBERS, TOTALS, CONFIG.tiers, 1, NOW_MS)
const ROWS = SAMPLE_MEMBERS.map((member) => memberListRowOf(member, CONFIG, NOW_MS))
const ACTIVITIES = ["active", "at_risk", "new"] as const

const EMPTY_QUEUE: DecisionQueueView = decisionQueueOf([], NOW_MS)
const QUEUE = decisionQueueOf(SAMPLE_DECISIONS, NOW_MS)

/** The queue as the owner sees it when a decision waits for someone else: no command to run. */
const WAITING_QUEUE: DecisionQueueView = {
    ...QUEUE,
    rows: QUEUE.rows.map((row) => ({ ...row, primary: null, menu: [], waitingFor: "Owner" })),
}

/**
 * The Loyalty reads in the states a prototype draws (ready, empty, and the decisions that wait for someone else) and the answer of
 * each action. Built from one set of sample members, rewards and campaigns through the module's own mappers, so the screen draws
 * what the reads would answer. Loading and error need no data.
 */
export const LOYALTY_FIXTURES: ModuleFixtures = {
    reads: {
        "loyalty.figures": {
            ready: computeFigures(SAMPLE_MEMBERS, STATS, NOW_MS),
            empty: computeFigures([], computeStats([], [], CONFIG.tiers, 0, NOW_MS), NOW_MS),
        },
        "loyalty.stats": { ready: STATS, empty: computeStats([], [], CONFIG.tiers, 0, NOW_MS) },
        "loyalty.tiers": {
            ready: { rows: tierRowsOf(CONFIG, SAMPLE_MEMBERS) },
            empty: { rows: [] },
        },
        "loyalty.members": { ready: { rows: ROWS, cursor: null }, empty: { rows: [], cursor: null } },
        "loyalty.tier-counts": {
            ready: {
                counts: Object.fromEntries(
                    ["dong", "bac", "vang"].map((key) => [key, ROWS.filter((row) => row.tierKey === key).length]),
                ),
                total: ROWS.length,
            },
            empty: { counts: { dong: 0, bac: 0, vang: 0 }, total: 0 },
        },
        "loyalty.member-counts": {
            ready: {
                counts: Object.fromEntries(
                    ACTIVITIES.map((name) => [name, ROWS.filter((row) => row.activity === name).length]),
                ),
                total: ROWS.length,
            },
            empty: { counts: { active: 0, at_risk: 0, new: 0 }, total: 0 },
        },
        "loyalty.member": {
            ready: memberDetailOf(FIRST, CONFIG, SAMPLE_ENTRIES, NOW_MS),
            empty: null,
        },
        "loyalty.member-rewards": {
            ready: {
                rows: SAMPLE_REWARDS.filter((reward) => reward.active && reward.pointsCost <= FIRST.points).map(
                    (reward) => ({
                        id: redeemKeyOf(FIRST.id, reward.id),
                        name: reward.name,
                        pointsCost: reward.pointsCost,
                        valueVnd: reward.valueVnd,
                    }),
                ),
            },
            empty: { rows: [] },
        },
        "loyalty.member-ledger": {
            ready: { rows: SAMPLE_ENTRIES.map((entry) => ledgerViewOf(entry)) },
            empty: { rows: [] },
        },
        "loyalty.rewards": {
            ready: { rows: SAMPLE_REWARDS.map((reward) => rewardViewOf(reward)) },
            empty: { rows: [] },
        },
        "loyalty.reward": { ready: rewardViewOf(FIRST_REWARD), empty: null },
        "loyalty.program": { ready: programViewOf(SAMPLE_PROGRAM) },
        "loyalty.campaigns": {
            ready: { rows: SAMPLE_CAMPAIGNS.map((campaign) => campaignViewOf(campaign)) },
            empty: { rows: [] },
        },
        "loyalty.pending": { ready: QUEUE, empty: EMPTY_QUEUE, waiting: WAITING_QUEUE },
        "loyalty.pending-waiting": {
            ready: waitingRegionOf(SAMPLE_DECISIONS, WAITING_SHOWN),
            empty: waitingRegionOf([], WAITING_SHOWN),
        },
        "loyalty.pending-count": { ready: { count: SAMPLE_DECISIONS.length }, empty: { count: 0 } },
    },
    actions: {
        "loyalty.adjust-points": { ok: true, data: { posted: true } },
        "loyalty.update-member": { ok: true, data: { id: FIRST.id } },
        "loyalty.redeem-reward": { ok: true, data: { code: "QT-0000R1", posted: true } },
        "loyalty.record-purchase": { ok: true, data: { status: "done", points: 120 } },
        "loyalty.save-reward": { ok: true, data: { id: FIRST_REWARD.id } },
        "loyalty.remove-reward": { ok: true, data: { removal: "deleted" } },
        "loyalty.add-preset-rewards": { ok: true, data: { added: 2 } },
        "loyalty.save-program": { ok: true, data: { slug: SAMPLE_PROGRAM.slug } },
        "loyalty.sync-members": { ok: true, data: { created: 2, linked: 3 } },
        "loyalty.draft-campaign": { ok: true, data: { campaignId: "c-3", status: "waiting", recipients: 0 } },
        "loyalty.preview-segment": { ok: true, data: { total: 2, reachable: 2, sample: ["Nguy\u1ec5n Th\u1ecb Lan"] } },
        "loyalty.decide": { ok: true, data: { id: "d-1" } },
    },
}
