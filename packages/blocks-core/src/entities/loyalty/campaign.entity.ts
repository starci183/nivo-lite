import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z } from "zod"
import type { ZodType } from "zod"

import { MAX_ID, MAX_LINE } from "../../bounds"

/** Where a campaign stands. */
export const CAMPAIGN_STATUSES: readonly [string, ...Array<string>] = [
    "waiting",
    "draft",
    "waiting_decision",
    "sending",
    "done",
    "failed",
]

/** Who a promotion is for. */
type CampaignSegment = {
    readonly tiers: ReadonlyArray<string>
    readonly inactiveDays: number
    readonly birthdayThisMonth: boolean
    readonly minSpendVnd: number
}

/** The segment of a campaign as the entity keeps it. */
export const campaignSegmentShape: ZodType<CampaignSegment> = z.object({
    tiers: z.array(z.string().max(MAX_ID)).max(50),
    inactiveDays: z.number().min(0),
    birthdayThisMonth: z.boolean(),
    minSpendVnd: z.number().min(0),
})

type CampaignFields = {
    readonly name: FieldDef<"text", false>
    readonly segment: FieldDef<"jsonb", false> & { readonly shape: ZodType<CampaignSegment> }
    readonly draft: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
    readonly workItemId: FieldDef<"uuid", true>
    readonly recipients: FieldDef<"int", false>
    readonly sent: FieldDef<"int", false>
    readonly failed: FieldDef<"int", false>
    readonly createdBy: FieldDef<"text", false>
}

const campaignFields: CampaignFields = {
    name: field.text({ maxLength: MAX_LINE }),
    segment: field.jsonb({ shape: campaignSegmentShape }),
    draft: field.text({ maxLength: 20_000, default: "empty" }),
    status: field.enum({ of: CAMPAIGN_STATUSES, default: { literal: "waiting" } }),
    workItemId: field.uuid({ nullable: true }),
    recipients: field.int({ default: { literal: 0 } }),
    sent: field.int({ default: { literal: 0 } }),
    failed: field.int({ default: { literal: 0 } }),
    createdBy: field.text({ maxLength: MAX_LINE }),
}

/** One promotion the owner asked for, with its delivery counts. Graph node kind `loyalty-campaign`. */
export const loyaltyCampaignEntity: EntityDefinition<CampaignFields> = defineEntity({
    name: "loyalty.campaign",
    dataKind: "loyalty-campaign",
    fields: campaignFields,
    indexes: [
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
    ],
})
