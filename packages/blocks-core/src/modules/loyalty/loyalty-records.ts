import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { resolveConfig } from "../../rules/loyalty/config"
import { campaignSegmentShape } from "../../entities/loyalty/campaign.entity"
import { loyaltyConfigShape } from "../../rules/loyalty/config.schema"
import type { ExpiryEntry } from "../../rules/loyalty/ledger.types"
import type { CampaignRow, DecisionItem, LedgerRow, MemberRow, ProgramRow, RewardRow } from "./loyalty.types"

/** The longest ISO 8601 text the engine writes for a time or a day. */
const MAX_TIME = 40

/** The most text a note, a draft or an evidence line holds. */
const MAX_TEXT = 20_000

/** A value or null, read as null when the engine left the key out. */
const orNull = <T extends z.ZodType>(schema: T) =>
    schema
        .nullable()
        .optional()
        .transform((value) => value ?? null)

const money = z.number().int().min(0)

const memberData = z.object({
    name: z.string().max(MAX_LINE),
    phone: orNull(z.string().max(MAX_LINE)),
    email: orNull(z.string().max(MAX_LINE)),
    birthday: orNull(z.string().max(MAX_TIME)),
    note: z.string().max(MAX_TEXT),
    tierKey: orNull(z.string().max(MAX_ID)),
    points: z.number().int(),
    lifetimeSpendVnd: money,
    visits: z.number().int().min(0),
    lastVisitAt: orNull(z.string().max(MAX_TIME)),
    joinedAt: z.string().max(MAX_TIME),
})

/** The fields a query for member rows selects. */
export const MEMBER_FIELDS: ReadonlyArray<string> = [
    "name",
    "phone",
    "email",
    "birthday",
    "note",
    "tierKey",
    "points",
    "lifetimeSpendVnd",
    "visits",
    "lastVisitAt",
    "joinedAt",
]

/** The customer a record holds; null when its fields are not those of a customer. */
export const memberOf = (record: RecordRow): MemberRow | null => {
    const parsed = memberData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

const ledgerKind = z.enum(["earn", "redeem", "expire", "adjust"])

const ledgerData = z.object({
    kind: ledgerKind,
    points: z.number().int(),
    amountVnd: orNull(money),
    evidence: orNull(z.string().max(MAX_TEXT)),
    by: z.string().max(MAX_LINE),
    expiresAt: orNull(z.string().max(MAX_TIME)),
    occurredAt: z.string().max(MAX_TIME),
})

/** The fields a query for ledger rows selects. */
export const LEDGER_FIELDS: ReadonlyArray<string> = [
    "kind",
    "points",
    "amountVnd",
    "evidence",
    "by",
    "expiresAt",
    "occurredAt",
]

/** The ledger entry a record holds; null when its fields are not those of an entry. */
export const ledgerRowOf = (record: RecordRow): LedgerRow | null => {
    const parsed = ledgerData.safeParse(record.data)
    return parsed.success ? { id: record.id, ...parsed.data } : null
}

/** The part of a ledger entry that decides what is still unspent; null when the record is no entry. */
export const expiryEntryOf = (record: RecordRow): ExpiryEntry | null => {
    const parsed = ledgerData.safeParse(record.data)
    return parsed.success
        ? { kind: parsed.data.kind, points: parsed.data.points, expiresAt: parsed.data.expiresAt }
        : null
}

const rewardData = z.object({
    key: z.string().max(MAX_ID),
    name: z.string().max(MAX_LINE),
    kind: z.enum(["voucher", "item", "percent"]),
    valueVnd: money,
    percent: orNull(z.number().int()),
    pointsCost: z.number().int().min(0),
    stock: orNull(z.number().int()),
    perCustomerLimit: orNull(z.number().int()),
    minTierKey: orNull(z.string().max(MAX_ID)),
    note: z.string().max(MAX_TEXT),
    active: z.boolean(),
})

/** The fields a query for reward rows selects. */
export const REWARD_FIELDS: ReadonlyArray<string> = [
    "key",
    "name",
    "kind",
    "valueVnd",
    "percent",
    "pointsCost",
    "stock",
    "perCustomerLimit",
    "minTierKey",
    "note",
    "active",
]

/** The reward a record holds; null when its fields are not those of a reward. */
export const rewardOf = (record: RecordRow): RewardRow | null => {
    const parsed = rewardData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

const programData = z.object({
    name: z.string().max(MAX_LINE),
    slug: z.string().max(MAX_LINE),
    enabled: z.boolean(),
    config: loyaltyConfigShape,
})

/** The fields a query for the programme row selects. */
export const PROGRAM_FIELDS: ReadonlyArray<string> = ["name", "slug", "enabled", "config"]

/** The programme a record holds, its rules resolved over the defaults; null when its fields are not those of a programme. */
export const programOfRecord = (record: RecordRow): ProgramRow | null => {
    const parsed = programData.safeParse(record.data)
    return parsed.success
        ? {
              name: parsed.data.name,
              slug: parsed.data.slug,
              enabled: parsed.data.enabled,
              config: resolveConfig(parsed.data.config),
              version: record.version,
          }
        : null
}

const campaignData = z.object({
    name: z.string().max(MAX_LINE),
    segment: campaignSegmentShape,
    draft: z.string().max(MAX_TEXT),
    status: z.enum(["waiting", "draft", "waiting_decision", "sending", "done", "failed"]),
    workItemId: orNull(z.string().max(MAX_ID)),
    recipients: z.number().int(),
    sent: z.number().int(),
    failed: z.number().int(),
    createdBy: z.string().max(MAX_LINE),
})

/** The fields a query for campaign rows selects. */
export const CAMPAIGN_FIELDS: ReadonlyArray<string> = [
    "name",
    "segment",
    "draft",
    "status",
    "workItemId",
    "recipients",
    "sent",
    "failed",
    "createdBy",
]

/** The campaign a record holds, created when the record was made; null when its fields are not those of a campaign. */
export const campaignOf = (record: RecordRow): CampaignRow | null => {
    const parsed = campaignData.safeParse(record.data)
    return parsed.success ? { id: record.id, ...parsed.data, createdAt: record.createdAt } : null
}

const decisionData = z.object({
    action: z.string().max(MAX_ID),
    summary: z.string().max(MAX_LINE),
    draft: z.string().max(MAX_TEXT),
    reason: orNull(z.string().max(MAX_TEXT)),
    amountVnd: orNull(money),
    customer: z.string().max(MAX_LINE),
})

/** The fields a query for decision rows selects. */
export const DECISION_FIELDS: ReadonlyArray<string> = ["action", "summary", "draft", "reason", "amountVnd", "customer"]

/** The decision a record holds, raised when the record was made; null when its fields are not those of a decision. */
export const decisionOf = (record: RecordRow): DecisionItem | null => {
    const parsed = decisionData.safeParse(record.data)
    return parsed.success ? { id: record.id, ...parsed.data, createdAt: record.createdAt } : null
}
