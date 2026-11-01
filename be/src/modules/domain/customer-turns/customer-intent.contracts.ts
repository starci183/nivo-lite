import type { DoorInput } from "@modules/domain/agent-turns"
import type { IntentInputPart } from "@modules/domain/intent-contracts"
import type { KnowledgeSources } from "./gateway-turns.contracts"

/** What a customer turn on the contract pipeline reads. */
export interface IntentContext {
    /** Who the agent is: one trusted line. */
    readonly identity: string
    /** The input in reading order: all of it data. */
    readonly input: ReadonlyArray<IntentInputPart>
    /** The knowledge the recall found for the question, as card sources. */
    readonly sources: KnowledgeSources
}

/** A reading a door answers with a reply: every reading but a split. */
export type ProposingReading = Exclude<DoorInput["reading"], { readonly kind: "split" }>

/** The persona of a customer turn, cut into the one trusted line and the owner's words about the agent. */
export interface PersonaParts {
    /** Who the agent is. */
    readonly identity: string
    /** The owner's instructions, knowledge and approval rule. */
    readonly instructions: string
}

/** The identity and input of a customer turn, before its sources are known. */
export interface IntentInput {
    /** Who the agent is: one trusted line. */
    readonly identity: string
    /** The input in reading order. */
    readonly input: ReadonlyArray<IntentInputPart>
}

/** How the connector door treats a turn: whether it runs on the contract pipeline, and whether a write must wait for a turn of its own. */
export interface PipelineGate {
    /** The turn runs on the contract pipeline. */
    readonly on: boolean
    /** A write is refused: the turn is on the pipeline and not pinned to an intent. */
    readonly refuses: boolean
}
