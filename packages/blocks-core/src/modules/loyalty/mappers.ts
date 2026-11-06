import { nextTier, tierByKey } from "../../rules/loyalty/config"
import type { LoyaltyConfig } from "../../rules/loyalty/config.types"
import { expiringSoon } from "../../rules/loyalty/expiry"
import type { ExpiryEntry } from "../../rules/loyalty/ledger.types"
import { activityOf } from "../../rules/loyalty/stats"
import type { DecisionQueueView, DecisionRowView, ItemsRegionView } from "../../views/views.types"
import { DECISION_COMMANDS, LOYALTY_DECISION_ACTIONS, PENDING_VIEW_ID } from "./constants"
import type {
    CampaignRow,
    DecisionItem,
    LedgerRow,
    MemberListRow,
    MemberRow,
    ProgramRow,
    RewardRow,
} from "./loyalty.types"
import type { CampaignRowView, LedgerRowView, MemberDetail, ProgramView, RewardView, TierRowView } from "./views.types"

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** The row the members list draws for a customer: the tier by name and how lively the customer is. */
export const memberListRowOf = (member: MemberRow, config: LoyaltyConfig, nowMs: number): MemberListRow => ({
    id: member.id,
    name: member.name,
    contact: member.phone ?? member.email ?? "",
    tier: tierByKey(config, member.tierKey)?.name ?? "",
    tierKey: member.tierKey,
    points: member.points,
    lifetimeSpendVnd: member.lifetimeSpendVnd,
    lastVisitAt: member.lastVisitAt,
    activity: activityOf(member, nowMs),
})

/** One customer in full, with the tier progress and the points about to expire. */
export const memberDetailOf = (
    member: MemberRow,
    config: LoyaltyConfig,
    entries: ReadonlyArray<ExpiryEntry>,
    nowMs: number,
): MemberDetail => {
    const next = nextTier(config, member.lifetimeSpendVnd)
    const expiring =
        config.expiry.months > 0 ? expiringSoon(entries, nowMs, config.expiry.warnDays) : { points: 0, firstAt: null }
    return {
        id: member.id,
        name: member.name,
        phone: member.phone ?? "",
        email: member.email ?? "",
        birthday: member.birthday ?? "",
        note: member.note,
        tier: tierByKey(config, member.tierKey)?.name ?? "",
        points: member.points,
        lifetimeSpendVnd: member.lifetimeSpendVnd,
        visits: member.visits,
        lastVisitAt: member.lastVisitAt ?? "",
        joinedAt: member.joinedAt,
        nextTier: next?.tier.name ?? "",
        missingVnd: next?.missingVnd ?? 0,
        expiringPoints: expiring.points,
        expiringAt: expiring.firstAt ?? "",
    }
}

/** The tiers of the ladder with the members who hold each. */
export const tierRowsOf = (config: LoyaltyConfig, members: ReadonlyArray<MemberRow>): ReadonlyArray<TierRowView> =>
    config.tiers.map((tier) => ({
        key: tier.key,
        name: tier.name,
        minSpendVnd: tier.minSpendVnd,
        multiplier: tier.multiplier,
        benefit: tier.benefit,
        count: members.filter((member) => member.tierKey === tier.key).length,
    }))

/** The ledger entry as a table draws it. */
export const ledgerViewOf = (entry: LedgerRow): LedgerRowView => ({
    id: entry.id,
    kind: entry.kind,
    points: entry.points,
    amountVnd: entry.amountVnd,
    evidence: entry.evidence ?? "",
    by: entry.by,
    occurredAt: entry.occurredAt,
})

/** The reward as the catalogue and the reward form draw it. */
export const rewardViewOf = (reward: RewardRow): RewardView => ({
    id: reward.id,
    name: reward.name,
    kind: reward.kind,
    valueVnd: reward.valueVnd,
    percent: reward.percent,
    pointsCost: reward.pointsCost,
    stock: reward.stock,
    perCustomerLimit: reward.perCustomerLimit,
    minTierKey: reward.minTierKey ?? "",
    note: reward.note,
    active: reward.active,
    state: reward.active ? "active" : "paused",
})

/** The programme flat, as the settings form draws it; a workspace that never saved one sees the starter rules. */
export const programViewOf = (program: ProgramRow): ProgramView => ({
    name: program.name,
    enabled: program.enabled,
    state: program.enabled ? "active" : "paused",
    slug: program.slug,
    publicPath: program.slug === "" ? "" : `/l/${program.slug}`,
    perThousandVnd: program.config.earn.perThousandVnd,
    perVisit: program.config.earn.perVisit,
    minOrderVnd: program.config.earn.minOrderVnd,
    trigger: program.config.earn.trigger,
    expiryMonths: program.config.expiry.months,
    warnDays: program.config.expiry.warnDays,
    birthdayOn: program.config.birthday.enabled,
    birthdayPoints: program.config.birthday.points,
    birthdayReward: program.config.birthday.rewardKey,
    birthdayNote: program.config.birthday.note,
    maxPerMonth: program.config.promo.maxPerMonth,
    hourFrom: program.config.promo.hourFrom,
    hourTo: program.config.promo.hourTo,
    batch: program.config.promo.batch,
})

/** The campaign as the promotions list draws it. */
export const campaignViewOf = (campaign: CampaignRow): CampaignRowView => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    recipients: campaign.recipients,
    sent: campaign.sent,
    failed: campaign.failed,
    draft: campaign.draft,
    createdBy: campaign.createdBy,
    createdAt: campaign.createdAt,
})

/** The decisions that are about loyalty among the waiting ones. */
export const loyaltyDecisionsOf = (items: ReadonlyArray<DecisionItem>): ReadonlyArray<DecisionItem> =>
    items.filter((item) => LOYALTY_DECISION_ACTIONS.includes(item.action))

/** How long a decision has waited, in a notation that needs no language: minutes, hours or days. */
export const ageOf = (createdAt: string, nowMs: number): string => {
    const waited = Math.max(0, nowMs - Date.parse(createdAt))
    if (waited >= DAY_MS) return `${Math.floor(waited / DAY_MS)}d`
    if (waited >= HOUR_MS) return `${Math.floor(waited / HOUR_MS)}h`
    return `${Math.floor(waited / 60_000)}m`
}

const decisionRowOf = (item: DecisionItem, nowMs: number): DecisionRowView => ({
    id: item.id,
    title: item.summary,
    description: item.customer,
    badges: [{ label: ageOf(item.createdAt, nowMs), tone: "neutral" }],
    reason: item.reason,
    amount: item.amountVnd === null ? null : String(item.amountVnd),
    proposal: item.draft === "" ? item.summary : item.draft,
    trace: null,
    expiry: null,
    primary: { id: DECISION_COMMANDS.approve, label: DECISION_COMMANDS.approve },
    edit: null,
    menu: [{ id: DECISION_COMMANDS.reject, label: DECISION_COMMANDS.reject, isDanger: true }],
    waitingFor: null,
})

/** The decision queue the pending view draws, oldest first. */
export const decisionQueueOf = (items: ReadonlyArray<DecisionItem>, nowMs: number): DecisionQueueView => ({
    count: items.length === 0 ? null : String(items.length),
    more: null,
    rows: items.map((item) => decisionRowOf(item, nowMs)),
})

/** Where choosing a waiting decision goes: the pending view. */
const PENDING_HREF = `?tab=${PENDING_VIEW_ID}`

/** The region of the overview that lists the first decisions waiting for the owner. */
export const waitingRegionOf = (items: ReadonlyArray<DecisionItem>, shown: number): ItemsRegionView => ({
    count: items.length === 0 ? null : String(items.length),
    rows: items.slice(0, shown).map((item) => ({
        id: item.id,
        title: item.summary,
        description: item.customer,
        href: PENDING_HREF,
    })),
    linkLabel: "",
    linkHref: "",
    more: items.length > shown ? String(items.length - shown) : null,
})
