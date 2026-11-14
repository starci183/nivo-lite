import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { CANDIDATE_TYPE } from "./hiring.reads"
import { SAMPLE_CANDIDATE, SAMPLE_CANDIDATE_ID } from "./hiring.samples"

type NoParams = Record<string, never>

/** The candidate who was mailed the invitation. */
export interface InviteMoveInput {
    /** The `blocks-core.hiring.candidate` record. */
    readonly candidateId: string
}

/** Whether the candidate moved to `interview`. */
export interface InviteMoveOutput {
    /** True once the candidate is at `interview`. */
    readonly moved: boolean
    /** True when a person declined the move on its card: the candidate was mailed, the record not moved. */
    readonly declined: boolean
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<InviteMoveInput> = z.object({ candidateId: z.string().min(1).max(MAX_ID) })
const output: NodeSchema<InviteMoveOutput> = z.object({
    moved: z.boolean().describe("True once the candidate is at interview."),
    declined: z.boolean().describe("True when a person declined the move on its card: the candidate was mailed, the record not moved."),
})

/** The move of the examples. */
const MOVE_ARGS = { type: CANDIDATE_TYPE, id: SAMPLE_CANDIDATE_ID, patch: { stage: "interview" } }

/**
 * `hiring.invite-move` (move to interview): once `hiring.invite` mailed the invitation, the candidate moves to `interview`
 * (`nivo.tool.record.update`, its ONE write; no AI call). A person who declines the move on its card made a decision (`declined`):
 * the candidate was mailed, the record not moved, and the graph tells the team. Any other refusal ends the step (`cannot`).
 */
export const hiringInviteMoveNode: TemplateNode<
    NodeSchema<InviteMoveInput>,
    NodeSchema<InviteMoveOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "hiring.invite-move",
    title: bilingualOf("nodeHiringInviteMoveTitle"),
    description: {
        vi: "Chuy\u1ec3n \u1ee9ng vi\u00ean \u0111\u00e3 \u0111\u01b0\u1ee3c g\u1eedi th\u01b0 m\u1eddi sang b\u01b0\u1edbc ph\u1ecfng v\u1ea5n.",
        en: "Moves the candidate who was mailed the invitation to the interview stage.",
    },
    tools: [],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    run: async (given, context) => {
        const moved = await context.tools.call(TOOL.recordUpdate, {
            type: CANDIDATE_TYPE,
            id: given.candidateId,
            patch: { stage: "interview" },
        })
        if (!moved.ok && moved.declined === true) return { moved: false, declined: true }
        valueOrCannot(context, TOOL.recordUpdate, moved)
        return { moved: true, declined: false }
    },
    examples: [
        {
            name: "moves the mailed candidate to interview",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID },
            tools: [{ id: TOOL.recordUpdate, args: MOVE_ARGS, answer: answered({ record: SAMPLE_CANDIDATE }) }],
            output: { moved: true, declined: false },
        },
        {
            name: "a person declined the move on its card: mailed, not moved",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID },
            tools: [{ id: TOOL.recordUpdate, args: MOVE_ARGS, answer: refused("declined") }],
            output: { moved: false, declined: true },
        },
    ],
})
