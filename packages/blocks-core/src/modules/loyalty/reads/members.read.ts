import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListShape, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { countsRead, listRead } from "@nivo-lite/agent-sdk/module"
import type { ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { redeemBlock, redeemKeyOf } from "../../../rules/loyalty/redeem"
import { configOf } from "../config-store"
import { LOYALTY_VIEW, TIMELINE_ROWS } from "../constants"
import { ledgerViewOf, memberDetailOf } from "../mappers"
import type { MemberListRow } from "../loyalty.types"
import { loyaltyLedger, loyaltyMembers, loyaltyMembersList, loyaltyProgram, loyaltyRewards } from "../ports"
import type { LedgerRowView, MemberDetail, RedeemableRowView } from "../views.types"

/** The activities a members list can be narrowed to. */
const ACTIVITIES: ReadonlyArray<string> = ["active", "at_risk", "new"]

/** What the members list accepts: a search over the name and contact, the activity as a filter, four sorts. */
export const MEMBERS_LIST: ListShape = {
    search: { fields: ["name", "contact"] },
    filters: { activity: { field: "activity", op: "eq", of: ACTIVITIES } },
    sort: {
        recent: [["lastVisitAt", "desc"]],
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

/** `loyalty.members`: the customers, searched, narrowed by activity and sorted. */
export const membersRead: ListReadDefinition = listRead({
    id: "loyalty.members",
    dataKind: "loyalty-member",
    permission: LOYALTY_VIEW,
    fields: ROW_FIELDS,
    list: MEMBERS_LIST,
    source: loyaltyMembersList,
})

/** `loyalty.member-counts`: how many customers each activity holds, under the same search. */
export const memberCountsRead: ReadDefinition = countsRead({
    id: "loyalty.member-counts",
    of: membersRead,
    by: "activity",
})

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

/** `loyalty.member`: one customer with the tier progress and the points about to expire; null when there is none. */
export const memberRead: ReadDefinition = defineRead({
    id: "loyalty.member",
    dataKind: "loyalty-member",
    shape: "record",
    fields: DETAIL_FIELDS,
    paths: {},
    variables: byId,
    permission: LOYALTY_VIEW,
    ports: { members: loyaltyMembers, ledger: loyaltyLedger, program: loyaltyProgram },
    run: async ({ members, ledger, program }, { id }, context): Promise<MemberDetail | null> => {
        const member = await members.get(id)
        if (member === null) return null
        const [config, entries] = await Promise.all([configOf(program), ledger.expiryEntries(id)])
        return memberDetailOf(member, config, entries, context.now.getTime())
    },
})

/** `loyalty.member-rewards`: the rewards the customer can redeem now, each with the id the redeem action takes. */
export const memberRewardsRead: ReadDefinition = defineRead({
    id: "loyalty.member-rewards",
    dataKind: "loyalty-redeemable",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: byId,
    permission: LOYALTY_VIEW,
    ports: { members: loyaltyMembers, ledger: loyaltyLedger, rewards: loyaltyRewards, program: loyaltyProgram },
    run: async (
        { members, ledger, rewards, program },
        { id },
    ): Promise<{ readonly rows: ReadonlyArray<RedeemableRowView> }> => {
        const member = await members.get(id)
        if (member === null) return { rows: [] }
        const [config, catalogue, counts] = await Promise.all([
            configOf(program),
            rewards.list(true),
            ledger.redeemedCounts(id),
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

/** `loyalty.member-ledger`: the newest entries of the points ledger of a customer. */
export const memberLedgerRead: ReadDefinition = defineRead({
    id: "loyalty.member-ledger",
    dataKind: "loyalty-ledger",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: byId,
    permission: LOYALTY_VIEW,
    ports: { ledger: loyaltyLedger },
    run: async ({ ledger }, { id }): Promise<{ readonly rows: ReadonlyArray<LedgerRowView> }> => ({
        rows: (await ledger.timeline(id, TIMELINE_ROWS)).map(ledgerViewOf),
    }),
})
