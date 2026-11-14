import { SALES_LOYALTY_DECIDE, SALES_MANAGE, SALES_VIEW } from "../../constants"
import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../../shared/bounds"
import { inSegment } from "../rules/segment"
import type { Segment } from "../rules/segment.types"
import { DECISION_COMMANDS } from "../constants"
import { createCampaign, decide } from "../loyalty-catalogue-data"
import { membersAll } from "../loyalty-member-data"
import { CAMPAIGNS, DECISIONS, MEMBERS } from "../ports"
import { CONFLICT, refusedWith } from "../refusals"
import { hostRecordId } from "./record-id"

const SAMPLE_SHOWN = 5

const segmentShape = {
    tiers: z.array(z.string().min(1).max(80)).max(8).optional(),
    inactiveDays: z.number().min(0).max(3650).nullable().optional(),
    birthdayThisMonth: z.boolean().nullable().optional(),
    minSpendVnd: z.number().min(0).max(1e12).nullable().optional(),
}

interface SegmentInput {
    readonly tiers?: ReadonlyArray<string> | undefined
    readonly inactiveDays?: number | null | undefined
    readonly birthdayThisMonth?: boolean | null | undefined
    readonly minSpendVnd?: number | null | undefined
}

/** The segment an input names; what it leaves out is no condition. */
const segmentOf = (input: SegmentInput): Segment => ({
    tiers: input.tiers ?? [],
    inactiveDays: Math.round(input.inactiveDays ?? 0),
    birthdayThisMonth: input.birthdayThisMonth ?? false,
    minSpendVnd: Math.round(input.minSpendVnd ?? 0),
})

const draftInput: z.ZodObject<
    typeof segmentShape & {
        id: typeof hostRecordId
        name: z.ZodOptional<z.ZodString>
        brief: z.ZodOptional<z.ZodString>
    }
> = z.object({
    id: hostRecordId,
    name: z.string().max(MAX_LINE).optional(),
    brief: z.string().max(500).optional(),
    ...segmentShape,
})

/**
 * `sales.loyalty-draft-campaign`: writes the draft of a promotion to a segment in the name of the member who asks. Nothing is sent from
 * here: the draft is submitted to the owner for a decision.
 */
export const draftCampaignAction: ActionDefinition = defineAction({
    id: "sales.loyalty-draft-campaign",
    permission: SALES_MANAGE,
    label: { key: "action_draft_campaign" },
    input: draftInput,
    ports: { campaigns: CAMPAIGNS },
    transactional: true,
    run: async ({ campaigns }, input, context) => {
        const created = await createCampaign(campaigns, {
            name: (input.name ?? "").trim(),
            segment: segmentOf(input),
            brief: (input.brief ?? "").trim(),
            createdBy: context.memberId,
        })
        if (created === null) return CONFLICT
        return {
            ok: true,
            data: { campaignId: created.campaignId, status: created.status, recipients: created.recipients },
        }
    },
    refreshes: ["blocks-core.sales.api.loyalty-campaign.list"],
    optimistic: false,
})

/** `sales.loyalty-preview-segment`: how many customers a segment holds and the first few names (how many can be written to waits for the core contact: it read the chatbot's conversations, another agent's records). */
export const previewSegmentAction: ActionDefinition = defineAction({
    id: "sales.loyalty-preview-segment",
    permission: SALES_VIEW,
    label: { key: "action_preview_segment" },
    input: z.object(segmentShape),
    ports: { members: MEMBERS },
    run: async ({ members }, input, context) => {
        const segment = segmentOf(input)
        const nowMs = context.now.getTime()
        const held = (await membersAll(members)).filter((member) => inSegment(member, segment, nowMs, context.timeZone))
        return {
            ok: true,
            data: {
                total: held.length,
                sample: held.slice(0, SAMPLE_SHOWN).map((member) => member.name),
            },
        }
    },
    refreshes: [],
    optimistic: false,
})

const decideInput: z.ZodObject<{ id: z.ZodString; command: z.ZodEnum<{ approve: "approve"; reject: "reject" }> }> =
    z.object({
        id: z.string().min(1).max(MAX_ID),
        command: z.enum([DECISION_COMMANDS.approve, DECISION_COMMANDS.reject]),
    })

/** `sales.loyalty-decide`: approves or rejects a decision about loyalty that waits for a person. */
export const decideAction: ActionDefinition = defineAction({
    id: "sales.loyalty-decide",
    permission: SALES_LOYALTY_DECIDE,
    label: { key: "loyalty_action_decide" },
    input: decideInput,
    ports: { decisions: DECISIONS },
    transactional: true,
    run: async ({ decisions }, { id, command }) => {
        const decided = await decide(decisions, id, command === DECISION_COMMANDS.approve ? "approved" : "rejected")
        if (decided.ok) return { ok: true, data: { id: decided.row.id } }
        return decided.reason === "missing" ? refusedWith("decision_missing") : CONFLICT
    },
    refreshes: [
        "blocks-core.sales.api.loyalty-decision.list",
        "blocks-core.sales.api.loyalty-decision.waiting",
        "blocks-core.sales.api.loyalty-decision.count",
        "blocks-core.sales.api.loyalty-campaign.list",
        "blocks-core.sales.api.loyalty-program.figures",
    ],
    optimistic: false,
})
