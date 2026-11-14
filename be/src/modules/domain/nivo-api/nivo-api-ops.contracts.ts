import type { Type } from "@nestjs/common"
import { Command, Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ExposedNivoApiVerb } from "./nivo-api.declarations"

/**
 * What an agent-scoped key narrows on one op: nothing (`data`: a NIVO data op runs by the holder's rights alone), the installation it
 * names (`installation`), the installation and the run it names (`installation_run`), the run it names (`run`), or the agents and stops
 * it answers (`agents`, `stops`: the other agents' are left out). Each op states its narrowing.
 */
export type NivoApiScope = "data" | "installation" | "installation_run" | "run" | "agents" | "stops"

/** What a request builder is handed beside the validated arguments: the key's workspace and the call's once-only key. */
export interface NivoApiCall {
    /** The key's workspace. */
    readonly workspaceId: string
    /** The once-only key of a write (every write carries one; null for a read). */
    readonly opKey: string | null
}

/** Builds the request of an op's message from its raw arguments: validates them with the op's declared input, then maps them. */
export type NivoApiRequestBuilder = (raw: unknown, call: NivoApiCall) => unknown

/** Shapes what an op's handler answered into the op's declared output. */
export type NivoApiAnswerShaper = (result: unknown) => unknown

/** The message classes the registry takes: a type only (the compiler compares a feature class constructor with its parameter loosely). */
declare class NivoApiQueryMessage extends Query<unknown> {
    constructor(params: ExecuteParams<unknown>)
}

/** The command counterpart of `NivoApiQueryMessage`. */
declare class NivoApiCommandMessage extends Command<unknown> {
    constructor(params: ExecuteParams<unknown>)
}

/** The class of a query a feature handler answers: built with the request an op builds and the holder as the principal. */
export type NivoApiQueryClass = typeof NivoApiQueryMessage

/** The class of a command a feature handler answers. */
export type NivoApiCommandClass = typeof NivoApiCommandMessage

/** An op that sends a query. */
export interface NivoApiQueryDispatch {
    /** The query bus. */
    readonly bus: "query"
    /** The query class. */
    readonly message: NivoApiQueryClass
}

/** An op that sends a command. */
export interface NivoApiCommandDispatch {
    /** The command bus. */
    readonly bus: "command"
    /** The command class. */
    readonly message: NivoApiCommandClass
}

/** The message an op sends: a query or a command of the feature that owns the op, with the bus it travels on. */
export type NivoApiDispatch = NivoApiQueryDispatch | NivoApiCommandDispatch

/** The queries one feature declares, by op name (a feature declares only the ops whose handlers it owns). */
export type NivoApiOpQueries = { readonly [V in ExposedNivoApiVerb]?: NivoApiQueryClass }

/** The commands one feature declares, by op name. */
export type NivoApiOpCommands = { readonly [V in ExposedNivoApiVerb]?: NivoApiCommandClass }

/**
 * The declaration of one feature's NIVO data ops: the query or command each op sends to the feature's handlers, and the handlers (with
 * their page services) composed without their GraphQL transport. Data only: the request, the answer and the key narrowing of every op
 * belong to the NIVO data op declarations (`nivo-api`). The app root lists the groups; the registry reads them.
 */
export interface NivoApiOpGroup {
    /** The query each read op sends. */
    readonly queries: NivoApiOpQueries
    /** The command each write op sends. */
    readonly commands: NivoApiOpCommands
    /** The application handlers and page services the ops' messages reach. */
    readonly handlers: ReadonlyArray<Type>
}

/** One exposed op as the registry answers it: everything the executor needs to run it. */
export interface NivoApiRegisteredOp {
    /** What an agent-scoped key narrows on this op. */
    readonly scope: NivoApiScope
    /** True when the op changes nothing (a write needs its once-only key). */
    readonly readOnly: boolean
    /** Builds the request of the op's message. */
    readonly request: NivoApiRequestBuilder
    /** Shapes the handler's answer into the op's declared output. */
    readonly answer: NivoApiAnswerShaper
    /** The message the op sends. */
    readonly dispatch: NivoApiDispatch
}

/** The registered op of a name, or null when no feature declares it. */
export type NivoApiOpLookup = NivoApiRegisteredOp | null

/** The ops the groups declare, and what the declarations expect that the groups do not cover or declare twice. */
export interface NivoApiOpTable {
    /** The registered ops by name. */
    readonly ops: ReadonlyMap<string, NivoApiRegisteredOp>
    /** The exposed ops no group declares. */
    readonly uncovered: ReadonlyArray<string>
    /** The ops more than one group declares. */
    readonly duplicated: ReadonlyArray<string>
}
