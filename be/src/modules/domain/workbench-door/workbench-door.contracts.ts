import type { ActionDefinition, ActionResult, ReadDefinition } from "@nivo-lite/agent-sdk/block"

/** One request to the door: for which workspace, what, and the JSON text the screen sent. The caller travels beside it. */
export interface DoorCall {
    /** The workspace selected in the request header; membership is proved before it is used. */
    readonly workspaceId: string
    /** The id of the read or action, `<module>.<name>`. */
    readonly name: string
    /** The variables of a read or the input of an action, as JSON text. */
    readonly payload: string
}

/** What the door answers: the JSON text of the data of a read or of the result of an action. */
export interface DoorAnswer {
    /** The JSON text. */
    readonly data: string
}

/** A read the door serves. */
export interface DoorRead {
    /** The declaration, which runs through `invokeRead`. */
    readonly definition: ReadDefinition
    /** The data kind of the rows the read yields; a counts read takes the kind of the list it counts. */
    readonly dataKind: string
}

/** An action the door serves; its declaration runs through `invokeAction`. */
export type DoorAction = ActionDefinition

/** The reads and actions the door serves, by id. */
export interface DoorRegistry {
    /** The reads that run in the package, by id. */
    readonly reads: ReadonlyMap<string, DoorRead>
    /** The actions that run in the package, by id. */
    readonly actions: ReadonlyMap<string, DoorAction>
}

/** What an action answered inside its transaction: set when it answered a refusal, so the transaction rolls back with it. */
export interface ActionAnswered {
    /** The refusal the action answered. */
    refusal?: ActionResult
}

/** The parsed payload of a call: a JSON object, or why it was refused. */
export type PayloadParse =
    { readonly ok: true; readonly value: Readonly<Record<string, unknown>> } | { readonly ok: false }
