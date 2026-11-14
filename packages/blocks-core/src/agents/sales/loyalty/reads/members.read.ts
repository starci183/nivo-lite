import { SALES_VIEW } from "../../constants"
import { defineRead, type ListShape, type ReadDefinition, type ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { portsOf } from "@nivo-lite/agent-sdk/port"
import { countsRead, listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import { z } from "zod"
import { MAX_ID } from "../../../../shared/bounds"
import { DEFAULT_CONFIG } from "../rules/config"
import { redeemBlock, redeemKeyOf } from "../rules/redeem"
import { configOf } from "../config-store"
import { TIMELINE_ROWS } from "../constants"
import { ledgerViewOf, memberDetailOf } from "../mappers"
import type { MemberListRow } from "../loyalty.types"
import { rewardsList } from "../loyalty-catalogue-data"
import { ledgerExpiryEntries, ledgerTimeline, memberById, redeemedCounts } from "../loyalty-member-data"
import { LEDGER, MEMBERS, PROGRAM, REWARDS, loyaltyMembersList } from "../ports"
import type { LedgerRowView, MemberDetail, RedeemableRowView } from "../views.types"

/** The activities a members list can be narrowed to. */
const ACTIVITIES: ReadonlyArray<string> = ["active", "at_risk", "new"]

/** The tier keys the starter ladder holds; the filter is open, and the read judges the key against the ladder the workspace saved. */
const TIER_KEYS: ReadonlyArray<string> = DEFAULT_CONFIG.tiers.map((tier) => tier.key)

/** What the members list accepts: a search over the name and contact, the activity and the tier as filters, four sorts. */
export const MEMBERS_LIST: ListShape = {
    search: { fields: ["name", "contact"] },
    filters: {
        activity: { field: "activity", op: "eq", of: ACTIVITIES },
        tier: { field: "tierKey", op: "eq", of: TIER_KEYS, open: true },
    },
    sort: {
        recent: [["lastActivityAt", "desc"]],
        points: [["points", "desc"]],
        spend: [["lifetimeSpendVnd", "desc"]],
        name: [["name", "asc"]],
    },
    page: { size: 30 },
    row: { id: "id", title: "name", description: "contact", badge: "tier" },
}

const ROW_FIELDS: ReadonlyArray<keyof MemberListRow> = [
    "id",
    "name",
    "contact",
    "tier",
    "tierKey",
    "points",
    "lifetimeSpendVnd",
    "lastVisitAt",
    "activity",
]

const listed: ListReadDefinition = listRead({
    id: "blocks-core.sales.api.loyalty-member.list",
    dataKind: "loyalty-member",
    permission: SALES_VIEW,
    fields: ROW_FIELDS,
    list: MEMBERS_LIST,
    source: loyaltyMembersList,
})

/** The tier the raw variables ask for; null for none or for every tier. */
const askedTierOf = (raw: unknown): string | null => {
    const tier: unknown = typeof raw === "object" && raw !== null ? Reflect.get(raw, "tier") : undefined
    return typeof tier === "string" && tier !== "all" ? tier : null
}

/** The refusal of a variable the read does not take: the problem at its name. */
const refusedAt = (at: string): ReadRunResult => ({ ok: false, problems: [{ code: "INPUT_INVALID", at }] })

/**
 * The members read with its tier judged against the ladder the workspace saved: any key of that ladder is taken (a renamed ladder
 * works), and a key that is not on it is refused as the problem at `tier`, so a stale link does not silently show nobody.
 */
export const withKnownTiers = (read: ListReadDefinition): ListReadDefinition => ({
    ...read,
    execute: async (provider, raw, context) => {
        const asked = askedTierOf(raw)
        if (asked !== null) {
            const { program } = portsOf(provider, { program: PROGRAM })
            const ladder = (await configOf(program)).tiers.map((tier) => tier.key)
            if (!ladder.includes(asked)) return refusedAt("tier")
        }
        return read.execute === undefined ? refusedAt(".") : read.execute(provider, raw, context)
    },
})

/** `blocks-core.sales.api.loyalty-member.list`: the customers, searched, narrowed by activity and by any tier of the saved ladder, and sorted. */
export const membersRead: ListReadDefinition = withKnownTiers(listed)

/** `blocks-core.sales.api.loyalty-member.counts`: how many customers each activity holds, under the same search. */
export const memberCountsRead: ReadDefinition = countsRead({
    id: "blocks-core.sales.api.loyalty-member.counts",
    of: membersRead,
    by: "activity",
})

/** `blocks-core.sales.api.loyalty-member.tier-counts`: how many customers each tier holds, under the same search. */
export const tierCountsRead: ReadDefinition = countsRead({ id: "blocks-core.sales.api.loyalty-member.tier-counts", of: membersRead, by: "tier" })

const byId: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

const DETAIL_FIELDS: ReadonlyArray<keyof MemberDetail> = [
    "id",
    "name",
    "phone",
    "email",
    "birthday",
    "note",
    "tier",
    "points",
    "lifetimeSpendVnd",
    "visits",
    "lastVisitAt",
    "joinedAt",
    "nextTier",
    "missingVnd",
    "expiringPoints",
    "expiringAt",
]

/** `blocks-core.sales.api.loyalty-member.get`: one customer with the tier progress and the points about to expire; null when there is none. */
export const memberRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-member.get",
    dataKind: "loyalty-member",
    shape: "record",
    fields: DETAIL_FIELDS,
    paths: {},
    variables: byId,
    permission: SALES_VIEW,
    ports: { members: MEMBERS, ledger: LEDGER, program: PROGRAM },
    run: async ({ members, ledger, program }, { id }, context): Promise<MemberDetail | null> => {
        const member = await memberById(members, id)
        if (member === null) return null
        const [config, entries] = await Promise.all([configOf(program), ledgerExpiryEntries(ledger, id)])
        return memberDetailOf(member, config, entries, context.now.getTime())
    },
})

/** `blocks-core.sales.api.loyalty-member.rewards`: the rewards the customer can redeem now, each with the id the redeem action takes. */
export const memberRewardsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-member.rewards",
    dataKind: "loyalty-redeemable",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: byId,
    permission: SALES_VIEW,
    ports: { members: MEMBERS, ledger: LEDGER, rewards: REWARDS, program: PROGRAM },
    run: async (
        { members, ledger, rewards, program },
        { id },
    ): Promise<{ readonly rows: ReadonlyArray<RedeemableRowView> }> => {
        const member = await memberById(members, id)
        if (member === null) return { rows: [] }
        const [config, catalogue, counts] = await Promise.all([
            configOf(program),
            rewardsList(rewards, true),
            redeemedCounts(ledger, id),
        ])
        return {
            rows: catalogue
                .filter(
                    (reward) =>
                        redeemBlock(config, reward, {
                            points: member.points,
                            tierKey: member.tierKey,
                            redeemedBefore: counts[reward.id] ?? 0,
                        }) === null,
                )
                .map((reward) => ({
                    id: redeemKeyOf(member.id, reward.id),
                    name: reward.name,
                    pointsCost: reward.pointsCost,
                    valueVnd: reward.valueVnd,
                })),
        }
    },
})

/** `blocks-core.sales.api.loyalty-ledger-entry.list`: the newest entries of the points ledger of a customer. */
export const memberLedgerRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-ledger-entry.list",
    dataKind: "loyalty-ledger",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: byId,
    permission: SALES_VIEW,
    ports: { ledger: LEDGER },
    run: async ({ ledger }, { id }): Promise<{ readonly rows: ReadonlyArray<LedgerRowView> }> => ({
        rows: (await ledgerTimeline(ledger, id, TIMELINE_ROWS)).map((item) => ledgerViewOf(item)),
    }),
})
