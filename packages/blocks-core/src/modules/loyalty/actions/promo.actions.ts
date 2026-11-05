import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../bounds"
import { inSegment } from "../../../rules/loyalty/segment"
import type { Segment } from "../../../rules/loyalty/segment.types"
import { DECISION_COMMANDS, LOYALTY_DECIDE, LOYALTY_MANAGE, LOYALTY_VIEW } from "../constants"
import { loyaltyCampaigns, loyaltyDecisions, loyaltyMembers } from "../ports"
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
 * `loyalty.draft-campaign`: writes the draft of a promotion to a segment in the name of the member who asks. Nothing is sent from
 * here: the draft is submitted to the owner for a decision.
 */
export const draftCampaignAction: ActionDefinition = defineAction({
    id: "loyalty.draft-campaign",
    permission: LOYALTY_MANAGE,
    label: { key: "action_draft_campaign" },
    input: draftInput,
    ports: { campaigns: loyaltyCampaigns },
    transactional: true,
    run: async ({ campaigns }, input, context) => {
        const created = await campaigns.create({
            name: (input.name ?? "").trim(),
            segment: segmentOf(input),
            brief: (input.brief ?? "").trim(),
            createdBy: context.memberId,
        })
        return {
            ok: true,
            data: { campaignId: created.campaignId, status: created.status, recipients: created.recipients },
        }
    },
    refreshes: ["loyalty.campaigns"],
    optimistic: false,
})

/** `loyalty.preview-segment`: how many customers a segment holds, how many of them can be written to, and the first few names. */
export const previewSegmentAction: ActionDefinition = defineAction({
    id: "loyalty.preview-segment",
    permission: LOYALTY_VIEW,
    label: { key: "action_preview_segment" },
    input: z.object(segmentShape),
    ports: { members: loyaltyMembers },
    run: async ({ members }, input, context) => {
        const segment = segmentOf(input)
        const nowMs = context.now.getTime()
        const held = (await members.all()).filter((member) => inSegment(member, segment, nowMs))
        const reachable = await members.reachable(held.map((member) => member.id))
        return {
            ok: true,
            data: {
                total: held.length,
                reachable,
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

/** `loyalty.decide`: approves or rejects a decision about loyalty that waits for a person. */
export const decideAction: ActionDefinition = defineAction({
    id: "loyalty.decide",
    permission: LOYALTY_DECIDE,
    label: { key: "action_decide" },
    input: decideInput,
    ports: { decisions: loyaltyDecisions },
    transactional: true,
    run: async ({ decisions }, { id, command }) => {
        const decided = await decisions.decide(id, command === DECISION_COMMANDS.approve ? "approved" : "rejected")
        if (decided.ok) return { ok: true, data: { id: decided.row.id } }
        return decided.reason === "missing" ? refusedWith("decision_missing") : CONFLICT
    },
    refreshes: [
        "loyalty.pending",
        "loyalty.pending-waiting",
        "loyalty.pending-count",
        "loyalty.campaigns",
        "loyalty.figures",
    ],
    optimistic: false,
})
