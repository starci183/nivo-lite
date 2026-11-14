import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { NodeSchema } from "../../nodes/node-schema.types"
import { answered, refused } from "../../nodes/tool-answers"
import { TEAM_CHAT_ASKED, TEAM_CHAT_FEE_PROPOSAL, TEAM_CHAT_FEE_PROPOSAL_JSON } from "./team-chat.node"
import type { TeamChatRoom } from "./team-chat.policy"
import { type TeamProposal, teamProposalSchema } from "./team-proposal"
import { bilingualOf } from "../../messages/catalog"

type NoParams = Record<string, never>

/** What is filed: the proposal an answer turn wrote, and the chat message it was said in. */
export interface TruthProposeInput {
    /** The chat it was said in: the person's private room with the agent, or a room of several people. */
    readonly room: TeamChatRoom
    /** The message it was said in. */
    readonly messageId: string
    /** The change, as the answer turn wrote it; null when the turn wrote none (nothing is filed). */
    readonly proposal: TeamProposal | null
}

/** The input as a graph binds it: the proposal may be absent (a ref to an answer turn's null member reads nothing). */
export type TruthProposeInputGiven = Omit<TruthProposeInput, "proposal"> & {
    /** The change to the shop knowledge that the team is asked to confirm; none when there is nothing to propose. */
    readonly proposal?: TeamProposal | null | undefined
}

/** How the filing went: nothing to file, filed for the owner, already the rule, already filed, or refused by the tool. */
export type TruthProposeOutcome = "none" | "filed" | "already_true" | "already_filed" | "refused"

/** What the step filed. */
export interface TruthProposeOutput {
    /** How the filing went. */
    readonly outcome: TruthProposeOutcome
    /** The change request the owner decides on a card, or null when none was filed or the tool refused. */
    readonly changeRequestId: string | null
    /** The tool's refusal code when it refused, else null. */
    readonly refusal: string | null
}

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<TruthProposeInput, TruthProposeInputGiven> = z.object({
    room: z.enum(["direct", "common"]),
    messageId: z.string().min(1).max(MAX_ID),
    proposal: teamProposalSchema.nullable().default(null),
})
const output: NodeSchema<TruthProposeOutput> = z.object({
    outcome: z.enum(["none", "filed", "already_true", "already_filed", "refused"]),
    changeRequestId: z.string().max(MAX_ID).nullable(),
    refusal: z.string().max(MAX_ID).nullable(),
})

/** The members of the propose tool's answer the step reads (ASSUMPTIONS-A, T6). */
const proposeAnswer = z.object({
    outcome: z.enum(["filed", "already_true", "already_filed"]),
    changeRequest: z.looseObject({ id: z.string().max(MAX_ID) }),
})

/** A proposal as the JSON the tool takes: the members the turn wrote; an absent member is left out, never sent as undefined. */
const proposalJsonOf = (proposal: TeamProposal): JsonObject =>
    Object.fromEntries(
        Object.entries(proposal).filter(
            (entry): entry is [string, string | boolean] =>
                typeof entry[1] === "string" || typeof entry[1] === "boolean",
        ),
    )

/** What filing the owner's new fee answers. */
const FILED = {
    outcome: "filed",
    changeRequest: {
        id: "p-ship",
        status: "proposed",
        subject: TEAM_CHAT_FEE_PROPOSAL.subject,
        attribute: TEAM_CHAT_FEE_PROPOSAL.attribute,
        value: TEAM_CHAT_FEE_PROPOSAL.value ?? null,
        kind: "set",
        waitsFor: "founder",
    },
} as const

/** The arguments of the filing in the examples: the proposal with the room and the message it was said in. */
const FEE_FILING: JsonObject = { ...TEAM_CHAT_FEE_PROPOSAL_JSON, room: "direct", messageId: TEAM_CHAT_ASKED }

/**
 * `team.truth-propose` (file a truth change for the owner): one call of `nivo.tool.brain.change.propose` with the proposal an answer
 * turn wrote and the chat message it was said in. It never puts anything in force: the owner decides on a card. No AI call. Generic:
 * `team.chat` and the four plugin `<module>.team-answer` turns all hand it the same `{ room, messageId, proposal }`. A proposal the turn
 * did not write (null: the graph's `ifNode` on it does not narrow the ref) files nothing (`none`). A refusal (words the quoted line does
 * not hold, a reason that says no why, a fact it replaces that is not found) is said in the output; the answer is posted all the same.
 */
export const teamTruthProposeNode: TemplateNode<
    NodeSchema<TruthProposeInput, TruthProposeInputGiven>,
    NodeSchema<TruthProposeOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "team.truth-propose",
    title: bilingualOf("nodeTeamTruthProposeTitle"),
    description: { vi: "G\u1eedi ch\u1ee7 c\u1eeda h\u00e0ng \u0111\u1ec1 xu\u1ea5t thay \u0111\u1ed5i th\u00f4ng tin c\u1eeda h\u00e0ng \u0111\u1ec3 ch\u1ee7 quy\u1ebft \u0111\u1ecbnh. Kh\u00f4ng c\u00f3 g\u00ec \u0111\u01b0\u1ee3c \u00e1p d\u1ee5ng khi ch\u01b0a c\u00f3 s\u1ef1 \u0111\u1ed3ng \u00fd.", en: "Files a proposed change to the shop's information for the owner to decide. Nothing takes effect without the owner's yes." },
    tools: [TOOL.brainChangePropose],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    run: async (given, context) => {
        if (given.proposal === null) return { outcome: "none", changeRequestId: null, refusal: null }
        const filed = await context.tools.call(TOOL.brainChangePropose, {
            ...proposalJsonOf(given.proposal),
            room: given.room,
            messageId: given.messageId,
        })
        if (!filed.ok) return { outcome: "refused", changeRequestId: null, refusal: filed.declined === true ? "declined" : filed.refusal }
        const read = proposeAnswer.parse(filed.value)
        return { outcome: read.outcome, changeRequestId: read.changeRequest.id, refusal: null }
    },
    examples: [
        {
            name: "files the owner's new lasting fee with the message it was said in, for the owner's yes",
            params: {},
            input: { room: "direct", messageId: TEAM_CHAT_ASKED, proposal: TEAM_CHAT_FEE_PROPOSAL },
            tools: [{ id: TOOL.brainChangePropose, args: FEE_FILING, answer: answered(FILED) }],
            output: { outcome: "filed", changeRequestId: "p-ship", refusal: null },
        },
        {
            name: "a value already in force is said as such, nothing new waits",
            params: {},
            input: { room: "direct", messageId: TEAM_CHAT_ASKED, proposal: TEAM_CHAT_FEE_PROPOSAL },
            tools: [
                {
                    id: TOOL.brainChangePropose,
                    args: FEE_FILING,
                    answer: answered({
                        ...FILED,
                        outcome: "already_true",
                        changeRequest: { ...FILED.changeRequest, id: "p-old" },
                    }),
                },
            ],
            output: { outcome: "already_true", changeRequestId: "p-old", refusal: null },
        },
        {
            name: "a refused filing (the quote is not what the line says) is said in the output",
            params: {},
            input: { room: "direct", messageId: TEAM_CHAT_ASKED, proposal: TEAM_CHAT_FEE_PROPOSAL },
            tools: [{ id: TOOL.brainChangePropose, args: FEE_FILING, answer: refused("quote_not_said") }],
            output: { outcome: "refused", changeRequestId: null, refusal: "quote_not_said" },
        },
        {
            name: "no proposal written: nothing is filed, no call",
            params: {},
            input: { room: "direct", messageId: TEAM_CHAT_ASKED, proposal: null },
            output: { outcome: "none", changeRequestId: null, refusal: null },
        },
    ],
})
