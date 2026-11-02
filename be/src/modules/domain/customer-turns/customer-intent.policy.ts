import type { CustomerTurn } from "@modules/domain/conversations"
import type { IntentInputPart } from "@modules/domain/intent-contracts"
import type { AgentTurnView } from "@modules/domain/agent-work"
import type { IntentAttachment, IntentFileRef, IntentPlanFiles } from "@modules/domain/agent-turns"
import type { IntentInput, PersonaParts } from "./customer-intent.contracts"
import { personaOf } from "./turn-prompt.policy"

/** How many earlier messages a turn carries, as on the road before contracts. */
const HISTORY_TURNS = 20

/** The line of the persona that says who the agent is; the rest of it is the owner's words about the agent. */
const splitPersona = (persona: string): PersonaParts => {
    const [identity = "", ...rest] = persona.split("\n")
    return { identity, instructions: rest.join("\n") }
}

/** The earlier messages of the conversation, one line each; the latest message is the turn's own part. */
const earlierOf = (turn: CustomerTurn): string =>
    turn.transcript
        .slice(-HISTORY_TURNS)
        .slice(0, -1)
        .map((line) => `${line.role === "user" ? "Customer" : "You"}: ${line.body}`)
        .join("\n")

/**
 * The identity and the input of a customer turn on the contract pipeline, in the order the model reads it. Only the identity is a
 * trusted line; the owner's instructions, the authority, the facts of the shop, the conversation and the customer's message are data.
 */
export const intentContextOf = (turn: CustomerTurn, authority: string, extras: ReadonlyArray<string>): IntentInput => {
    const { identity, instructions } = splitPersona(personaOf(turn.conversation.agent, turn.conversation.speaksAs))
    const input: ReadonlyArray<IntentInputPart> = [
        { kind: "owner_instructions", text: instructions },
        { kind: "authority", text: authority },
        { kind: "shop_facts", text: extras.filter((extra) => extra !== "").join("\n\n") },
        { kind: "transcript", text: earlierOf(turn) },
        { kind: "customer_message", text: turn.body },
    ]
    return { identity, input: input.filter((part) => part.text.trim() !== "") }
}

/** Where the files of a customer's message are. */
export const customerFileRefOf = (workspaceId: string, conversationId: string, messageId: string): IntentFileRef => ({
    workspaceId,
    kind: "customer",
    conversationId,
    messageId,
    threadId: null,
})

/** The files of the wake of a customer turn, from the ids its wake carries; none names no message. */
export const wakeFileRefOf = (turn: AgentTurnView): IntentFileRef | null =>
    turn.context.conversationId === undefined || turn.context.messageId === undefined
        ? null
        : customerFileRefOf(turn.workspaceId, turn.context.conversationId, turn.context.messageId)

/** The attachments of a plan: spread into it, nothing for a message with no file. */
export const planFilesOf = (attachments: ReadonlyArray<IntentAttachment>): IntentPlanFiles =>
    attachments.length === 0 ? {} : { attachments }
