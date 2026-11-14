import { redeemKeyOf } from "../../../../rules/sales/loyalty/redeem"
import type { LedgerTotal } from "../../../../rules/sales/loyalty/ledger.types"
import { computeFigures, computeStats } from "../../../../rules/sales/loyalty/stats"
import { DEFAULT_TIME_ZONE } from "../../../../entities/workspace/time-zone"
import type { DecisionQueueView } from "../../../../views/views.types"
import { STARTER_PROGRAM } from "../config-store"
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
import type { ModuleFixtures } from "../../../module-fixtures"
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

const STATS = computeStats(SAMPLE_MEMBERS, TOTALS, CONFIG.tiers, 1, NOW_MS, DEFAULT_TIME_ZONE)
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
        "blocks-core.sales.api.loyalty-program.figures": {
            ready: computeFigures(SAMPLE_MEMBERS, STATS, NOW_MS),
            empty: computeFigures([], computeStats([], [], CONFIG.tiers, 0, NOW_MS, DEFAULT_TIME_ZONE), NOW_MS),
        },
        "blocks-core.sales.api.loyalty-member.stats": { ready: STATS, empty: computeStats([], [], CONFIG.tiers, 0, NOW_MS, DEFAULT_TIME_ZONE) },
        "blocks-core.sales.api.loyalty-program.tiers": {
            ready: { rows: tierRowsOf(CONFIG, SAMPLE_MEMBERS) },
            empty: { rows: [] },
        },
        "blocks-core.sales.api.loyalty-member.list": { ready: { rows: ROWS, cursor: null }, empty: { rows: [], cursor: null } },
        "blocks-core.sales.api.loyalty-member.tier-counts": {
            ready: {
                counts: Object.fromEntries(
                    ["dong", "bac", "vang"].map((key) => [key, ROWS.filter((row) => row.tierKey === key).length]),
                ),
                total: ROWS.length,
            },
            empty: { counts: { dong: 0, bac: 0, vang: 0 }, total: 0 },
        },
        "blocks-core.sales.api.loyalty-member.counts": {
            ready: {
                counts: Object.fromEntries(
                    ACTIVITIES.map((name) => [name, ROWS.filter((row) => row.activity === name).length]),
                ),
                total: ROWS.length,
            },
            empty: { counts: { active: 0, at_risk: 0, new: 0 }, total: 0 },
        },
        "blocks-core.sales.api.loyalty-member.get": {
            ready: memberDetailOf(FIRST, CONFIG, SAMPLE_ENTRIES, NOW_MS),
            empty: null,
        },
        "blocks-core.sales.api.loyalty-member.rewards": {
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
        "blocks-core.sales.api.loyalty-ledger-entry.list": {
            ready: { rows: SAMPLE_ENTRIES.map((item) => ledgerViewOf(item)) },
            empty: { rows: [] },
        },
        "blocks-core.sales.api.loyalty-reward.list": {
            ready: { rows: SAMPLE_REWARDS.map((item) => rewardViewOf(item)) },
            empty: { rows: [] },
        },
        "blocks-core.sales.api.loyalty-reward.get": { ready: rewardViewOf(FIRST_REWARD), empty: null },
        "blocks-core.sales.api.loyalty-program.get": { ready: programViewOf(SAMPLE_PROGRAM), empty: programViewOf(STARTER_PROGRAM) },
        "blocks-core.sales.api.loyalty-campaign.list": {
            ready: { rows: SAMPLE_CAMPAIGNS.map((item) => campaignViewOf(item)) },
            empty: { rows: [] },
        },
        "blocks-core.sales.api.loyalty-decision.list": { ready: QUEUE, empty: EMPTY_QUEUE, waiting: WAITING_QUEUE },
        "blocks-core.sales.api.loyalty-decision.waiting": {
            ready: waitingRegionOf(SAMPLE_DECISIONS, WAITING_SHOWN),
            empty: waitingRegionOf([], WAITING_SHOWN),
        },
        "blocks-core.sales.api.loyalty-decision.count": { ready: { count: SAMPLE_DECISIONS.length }, empty: { count: 0 } },
    },
    actions: {
        "sales.loyalty-adjust-points": { ok: true, data: { posted: true } },
        "sales.loyalty-update-member": { ok: true, data: { id: FIRST.id } },
        "sales.loyalty-redeem-reward": { ok: true, data: { code: "QT-0000R1", posted: true } },
        "sales.loyalty-record-purchase": { ok: true, data: { status: "done", points: 120 } },
        "sales.loyalty-save-reward": { ok: true, data: { id: FIRST_REWARD.id } },
        "sales.loyalty-remove-reward": { ok: true, data: { removal: "deleted" } },
        "sales.loyalty-add-preset-rewards": { ok: true, data: { added: 2 } },
        "sales.loyalty-save-program": { ok: true, data: { slug: SAMPLE_PROGRAM.slug } },
        "sales.loyalty-sync-members": { ok: true, data: { created: 2, linked: 3 } },
        "sales.loyalty-draft-campaign": { ok: true, data: { campaignId: "c-3", status: "waiting", recipients: 0 } },
        "sales.loyalty-preview-segment": { ok: true, data: { total: 2, sample: ["Nguy\u1ec5n Th\u1ecb Lan"] } },
        "sales.loyalty-decide": { ok: true, data: { id: "d-1" } },
    },
}
