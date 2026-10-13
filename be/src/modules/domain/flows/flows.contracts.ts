import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The operations of the operating flow a member can ask for. */
export type FlowCommandKind =
    | "save_authority"
    | "save_rule"
    | "save_staff"
    | "decide"
    | "hold"
    | "assign"
    | "simulate_inbound"
    | "take_over"
    | "send_as_human"
    | "authority_from_chat"
    | "owner_chat"

/** The operations only an owner or manager may ask for. */
export const MANAGER_COMMANDS: ReadonlyArray<FlowCommandKind> = [
    "save_authority",
    "save_rule",
    "save_staff",
    "assign",
    "authority_from_chat",
]

/** What a command carries, by name. */
export interface FlowPayload {
    /** Any value the command carries. */
    readonly [name: string]: unknown
}

/** One command for the flow engine, with the member who asked. */
export interface FlowCommand {
    /** What to do. */
    readonly kind: FlowCommandKind
    /** The workspace. */
    readonly workspaceId: string
    /** The member who asked; the engine records them as the decider or author. */
    readonly member: WorkspaceMember
    /** The inputs of the command. */
    readonly payload: FlowPayload
}

/** What the flow engine answers. */
export interface FlowResult {
    /** The answer, as the engine builds it (the work item, the authority, the rule...). */
    readonly data: FlowPayload
}

/** The operating-flow engine (gate, work items, authority): the decisions capability binds it. */
export interface FlowGate {
    /** Runs one command and answers its result. */
    run(command: FlowCommand): Promise<FlowResult>
}

/** What a member asks the flow to do. */
export interface FlowRequest {
    /** What to do. */
    readonly kind: FlowCommandKind
    /** The inputs of the command. */
    readonly payload: object
}
