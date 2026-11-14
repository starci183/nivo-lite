import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { q, type FilterExpr } from "@nivo-lite/agent-sdk/query"
import { campaignSegmentShape } from "../entities/loyalty-campaign.entity"
import { PROGRAM_KEY } from "../entities/loyalty-program.entity"
import { loyaltyConfigShape } from "./rules/config.schema"
import { rewardKey } from "./rules/reward"
import type { RewardEdit } from "./rules/reward.types"
import type {
    CampaignCreated,
    CampaignRequest,
    CampaignRow,
    DecisionItem,
    ProgramRow,
    ProgramSave,
    RewardRemoval,
    RewardRow,
    StoreResult,
    Verdict,
} from "./loyalty.types"
import {
    CAMPAIGN_FIELDS,
    DECISION_FIELDS,
    PROGRAM_FIELDS,
    REWARD_FIELDS,
    campaignOf,
    decisionOf,
    programOfRecord,
    rewardOf,
} from "./loyalty-records"
import { REWARDS_MAX, RETRIES, firstOf, numberOf, resultOf, rowsOf } from "./loyalty-paging"

/** The most suffixes a reward key tries before the save is given up as a conflict. */
const KEY_SUFFIXES_MAX = 20

/** The name a promotion gets when its owner gave none. */
const CAMPAIGN_NAME = "Promotion"

/** The name the agent writes under. */
const AGENT = "NIVO"

/** The reward; null when there is none or the record is not one. */
export const rewardById = async (rewards: EntityApi, id: string): Promise<RewardRow | null> => {
    const found = await rewards.get(id)
    return found === null ? null : rewardOf(found)
}

/** The rewards, newest first; only the active ones when `activeOnly`. */
export const rewardsList = async (rewards: EntityApi, activeOnly: boolean): Promise<ReadonlyArray<RewardRow>> => {
    const where: FilterExpr | undefined = activeOnly ? q.eq("active", true) : undefined
    const rows = await rowsOf(
        rewards,
        {
            select: REWARD_FIELDS,
            ...(where === undefined ? {} : { where }),
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
        },
        REWARDS_MAX,
    )
    return rows.flatMap((listed) => rewardOf(listed.row) ?? [])
}

/** The values an edit of a reward writes. */
const rewardValues = (edit: RewardEdit): Readonly<Record<string, string | number | boolean | null>> => ({
    name: edit.name,
    kind: edit.kind,
    valueVnd: edit.valueVnd,
    percent: edit.percent,
    pointsCost: edit.pointsCost,
    stock: edit.stock,
    perCustomerLimit: edit.perCustomerLimit,
    minTierKey: edit.minTierKey,
    note: edit.note,
    active: edit.active,
})

/** The key a new reward is tried under: the base, then the base with a growing suffix. */
const keyAttempt = (base: string, attempt: number): string => (attempt === 0 ? base : `${base}-${attempt + 1}`)

/** Inserts a new reward under its key, trying a suffixed key while another reward holds the key. */
const insertReward = async (
    rewards: EntityApi,
    edit: RewardEdit,
    base: string,
    attempt: number,
): Promise<StoreResult<RewardRow>> => {
    if (attempt >= KEY_SUFFIXES_MAX) return { ok: false, reason: "conflict" }
    const written = await rewards.insert({ ...rewardValues(edit), key: keyAttempt(base, attempt) })
    if (!written.ok && written.reason === "taken") return insertReward(rewards, edit, base, attempt + 1)
    return resultOf(written, rewardOf)
}

/** Creates the reward, or changes the one the edit names; a name taken by another reward gets a suffixed key. */
export const saveReward = async (rewards: EntityApi, edit: RewardEdit): Promise<StoreResult<RewardRow>> => {
    if (edit.id === undefined) return insertReward(rewards, edit, edit.key ?? rewardKey(edit.name), 0)
    const current = await rewardById(rewards, edit.id)
    if (current === null) return { ok: false, reason: "missing" }
    return resultOf(await rewards.update(current.id, current.version, rewardValues(edit)), rewardOf)
}

/** Deletes a reward nobody redeemed; one with history is paused instead. */
export const removeReward = async (rewards: EntityApi, ledger: EntityApi, id: string): Promise<RewardRemoval> => {
    const current = await rewardById(rewards, id)
    if (current === null) return "missing"
    const history = await firstOf(ledger, {
        select: ["kind"],
        where: q.eq("rewardId", id),
        order: [
            ["rewardId", "asc"],
            ["id", "asc"],
        ],
    })
    if (history !== null) {
        const paused = await rewards.update(current.id, current.version, { active: false })
        return paused.ok ? "retired" : "missing"
    }
    const removed = await rewards.delete(current.id, current.version)
    return removed.ok ? "deleted" : "missing"
}

/** Takes one unit from the stock of a reward that has stock, reading the reward again when another write got in first. */
export const takeOne = async (rewards: EntityApi, id: string, attempts: number = RETRIES): Promise<void> => {
    const current = await rewardById(rewards, id)
    if (typeof current?.stock !== "number" || attempts <= 0) return
    const written = await rewards.update(current.id, current.version, { stock: current.stock - 1 })
    if (!written.ok && written.reason === "stale") await takeOne(rewards, id, attempts - 1)
}

/** Adds the rewards whose key the catalogue lacks; how many were added. */
export const addMissingRewards = async (rewards: EntityApi, edits: ReadonlyArray<RewardEdit>): Promise<number> => {
    const held = new Set((await rewardsList(rewards, false)).map((reward) => reward.key))
    const lacking = edits.filter((edit) => !held.has(edit.key ?? rewardKey(edit.name)))
    const added = await Promise.all(
        lacking.map((edit) => rewards.insert({ ...rewardValues(edit), key: edit.key ?? rewardKey(edit.name) })),
    )
    return added.filter((written) => written.ok).length
}

/** The saved programme; null before the first save. */
export const programGet = async (program: EntityApi): Promise<ProgramRow | null> => {
    const found = await firstOf(program, {
        select: PROGRAM_FIELDS,
        where: q.eq("scope", PROGRAM_KEY),
        order: [
            ["scope", "asc"],
            ["id", "asc"],
        ],
    })
    return found === null ? null : programOfRecord(found)
}

/** Creates or changes the programme; null when the engine refused the write. */
export const programSave = async (program: EntityApi, save: ProgramSave): Promise<ProgramRow | null> => {
    const written = await program.upsert("scope_key", {
        scope: PROGRAM_KEY,
        name: save.name,
        slug: save.slug,
        enabled: save.enabled,
        config: loyaltyConfigShape.parse(save.config),
    })
    return written.ok ? programOfRecord(written.row) : null
}

/** The newest promotions, at most `limit`. */
export const campaignsList = async (campaigns: EntityApi, limit: number): Promise<ReadonlyArray<CampaignRow>> => {
    const rows = await rowsOf(
        campaigns,
        {
            select: CAMPAIGN_FIELDS,
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
        },
        limit,
    )
    return rows.flatMap((listed) => campaignOf(listed.row) ?? [])
}

/** How many promotions were sent since an instant, ISO 8601. */
export const campaignsSentSince = async (campaigns: EntityApi, sinceIso: string): Promise<number> => {
    const [row] = await campaigns.aggregate({
        where: q.gte("createdAt", sinceIso),
        measures: { sent: { kind: "sum", field: "sent" } },
        limit: 1,
    })
    return numberOf(row?.measures["sent"])
}

/** Writes a campaign as a draft that waits to be drafted; nothing is sent from here. Null when the engine refused the write. */
export const createCampaign = async (
    campaigns: EntityApi,
    request: CampaignRequest,
): Promise<CampaignCreated | null> => {
    const written = await campaigns.insert({
        name: request.name === "" ? CAMPAIGN_NAME : request.name,
        segment: campaignSegmentShape.parse(request.segment),
        draft: request.brief,
        status: "waiting",
        createdBy: request.createdBy ?? AGENT,
    })
    return written.ok ? { campaignId: written.row.id, status: "waiting", recipients: 0 } : null
}

/** The waiting decisions, oldest first, at most `limit`. */
export const decisionsWaiting = async (decisions: EntityApi, limit: number): Promise<ReadonlyArray<DecisionItem>> => {
    const rows = await rowsOf(
        decisions,
        {
            select: DECISION_FIELDS,
            where: q.eq("status", "waiting"),
            order: [
                ["status", "asc"],
                ["createdAt", "asc"],
                ["id", "asc"],
            ],
        },
        limit,
    )
    return rows.flatMap((listed) => decisionOf(listed.row) ?? [])
}

/** Gives a waiting decision its verdict; the decision as decided. A decision that is gone or was decided is missing. */
export const decide = async (
    decisions: EntityApi,
    id: string,
    verdict: Verdict,
): Promise<StoreResult<DecisionItem>> => {
    const found = await decisions.get(id)
    if (found?.data["status"] !== "waiting") return { ok: false, reason: "missing" }
    return resultOf(await decisions.update(found.id, found.version, { status: verdict }), decisionOf)
}
