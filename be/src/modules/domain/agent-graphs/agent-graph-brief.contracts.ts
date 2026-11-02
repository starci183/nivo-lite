import type { TurnContracts } from "@modules/domain/intent-contracts"

/** One thing the action graph lets the agent ask for. */
export interface GraphIntent {
    /** The authority action key. */
    readonly action: string
    /** What it does, in the owner's words. */
    readonly label: string
}

/** The node keys of the published graph a pipeline turn's steps stand for. */
export interface IntentNodeKeys {
    /** The node of the trigger path where the turn picks what to do. */
    readonly turn: string
    /** The act node of each intent the graph holds, by intent. */
    readonly acts: Readonly<Record<string, string>>
    /** The reachable reply node of this trigger path, absent when the graph declares no reply channel. */
    readonly reply?: string
}

/** What a turn that picks by contract is made of, or null: the turn stays on the prompt it had before contracts. */
export type OptionalTurnContracts = TurnContracts | null
