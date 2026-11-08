import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { PortsOf, RunContext } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { computeFigures, computeStats } from "../../../rules/loyalty/stats"
import type { LoyaltyFigures, LoyaltyStats } from "../../../rules/loyalty/stats.types"
import { LOYALTY_VIEW, WINDOW_DAYS } from "../constants"
import { configOf } from "../config-store"
import { tierRowsOf } from "../mappers"
import { campaignsSentSince } from "../loyalty-catalogue-data"
import { ledgerTotalsSince, membersAll } from "../loyalty-member-data"
import { CAMPAIGNS, LEDGER, MEMBERS, PROGRAM } from "../ports"
import type { MemberRow } from "../loyalty.types"
import type { TierRowView } from "../views.types"

const DAY_MS = 86_400_000

const variables: z.ZodObject<Record<string, never>> = z.object({})

const boardPorts = {
    members: MEMBERS,
    ledger: LEDGER,
    campaigns: CAMPAIGNS,
    program: PROGRAM,
}

/** The members and the statistics of the last 30 days worked out from them. */
const boardOf = async (
    ports: PortsOf<typeof boardPorts>,
    context: RunContext,
): Promise<{ readonly members: ReadonlyArray<MemberRow>; readonly stats: LoyaltyStats }> => {
    const nowMs = context.now.getTime()
    const sinceIso = new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString()
    const [members, totals, sent, config] = await Promise.all([
        membersAll(ports.members),
        ledgerTotalsSince(ports.ledger, sinceIso),
        campaignsSentSince(ports.campaigns, sinceIso),
        configOf(ports.program),
    ])
    return { members, stats: computeStats(members, totals, config.tiers, sent, nowMs) }
}

/** The fields of the ribbon. */
export const FIGURE_FIELDS: ReadonlyArray<keyof LoyaltyFigures> = [
    "members",
    "activeMembers",
    "pointsIssued30d",
    "redemptions30d",
    "pointsRedeemed30d",
    "atRisk",
]

/** The fields of the statistics. */
export const STAT_FIELDS: ReadonlyArray<keyof LoyaltyStats> = [
    "members",
    "active90d",
    "pointsOutstanding",
    "earned30d",
    "redeemed30d",
    "expired30d",
    "redemptions30d",
    "spend30d",
    "rewardValue30d",
    "promosSent30d",
    "birthdaysThisMonth",
    "tierCounts",
]

/** `loyalty.figures`: the ribbon of the workbench, worked out from the same rows as the tabs. */
export const figuresRead: ReadDefinition = defineRead({
    id: "loyalty.figures",
    dataKind: "loyalty-figures",
    shape: "record",
    fields: FIGURE_FIELDS,
    paths: {},
    variables,
    permission: LOYALTY_VIEW,
    ports: boardPorts,
    run: async (ports, _variables, context): Promise<LoyaltyFigures> => {
        const { members, stats } = await boardOf(ports, context)
        return computeFigures(members, stats, context.now.getTime())
    },
})

/** `loyalty.stats`: what the programme did in the last 30 days. */
export const statsRead: ReadDefinition = defineRead({
    id: "loyalty.stats",
    dataKind: "loyalty-stats",
    shape: "record",
    fields: STAT_FIELDS,
    paths: { tierCounts: "list" },
    variables,
    permission: LOYALTY_VIEW,
    ports: boardPorts,
    run: async (ports, _variables, context): Promise<LoyaltyStats> => (await boardOf(ports, context)).stats,
})

/** `loyalty.tiers`: the ladder with the members who hold each tier. */
export const tiersRead: ReadDefinition = defineRead({
    id: "loyalty.tiers",
    dataKind: "loyalty-tier",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables,
    permission: LOYALTY_VIEW,
    ports: { members: MEMBERS, program: PROGRAM },
    run: async ({ members, program }): Promise<{ readonly rows: ReadonlyArray<TierRowView> }> => ({
        rows: tierRowsOf(await configOf(program), await membersAll(members)),
    }),
})
