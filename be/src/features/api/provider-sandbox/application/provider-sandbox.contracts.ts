import type { ConnectionRecord } from "@modules/domain/connections"


/** What the sandbox reads that is about the workspace only take. */
export interface SandboxWorkspaceRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** What the sandbox reads that are about one provider take. */
export interface SandboxProviderRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The provider key. */
    readonly provider: string
}

/** What the sandbox doors about one sandbox account take. */
export interface SandboxAccountRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The sandbox account (a connection). */
    readonly connectionId: string
}

/** What attachSandboxAccount and detachSandboxAccount take. */
export interface SandboxAgentRequest extends SandboxAccountRequest {
    /** The agent to attach or detach. */
    readonly agentId: string
}

/** One agent a sandbox account is attached to. */
export interface SandboxAccountAgentView {
    /** The agent. */
    readonly id: string
    /** The agent's name, else its id. */
    readonly label: string
}

/** One sandbox account with the agents it is attached to. */
export interface SandboxAccountView {
    /** The account (a connection). */
    readonly account: ConnectionRecord
    /** The agents it is attached to. */
    readonly agents: ReadonlyArray<SandboxAccountAgentView>
}

/** What sandboxCalls takes. */
export interface SandboxCallsRequest extends SandboxAccountRequest {
    /** Only the calls of this operation, when given. */
    readonly operation?: string | undefined
}

/** What sandboxWaitingRuns takes. */
export interface SandboxWaitingRunsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** How many runs at most; absent means 20, more than 50 means 50. */
    readonly limit?: number | undefined
}

/** What openSandboxAccount takes. */
export interface OpenSandboxAccountRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The provider key (one of the connections' providers). */
    readonly provider: string
    /** The name of the account. */
    readonly name: string
    /** The agents to attach the account to, in one action (attached, bound and its triggers on); none when empty. */
    readonly attachTo: ReadonlyArray<string>
}

/** One input the page gives an inbound case, as text (the handler converts it to the field's kind). */
export interface SandboxGivenInput {
    /** The field name. */
    readonly name: string
    /** The value as typed. */
    readonly value: string
}

/** What sendSandboxCase takes. */
export interface SendSandboxCaseRequest extends SandboxAccountRequest {
    /** The inbound case. */
    readonly caseId: string
    /** The inputs given; a field not given is prefilled by the domain. */
    readonly inputs: ReadonlyArray<SandboxGivenInput>
}

/** What setSandboxNextCase takes. */
export interface SetSandboxNextCaseRequest extends SandboxAccountRequest {
    /** The outbound case to answer next. */
    readonly caseId: string
}

/** What expireSandboxWait takes. */
export interface ExpireSandboxWaitRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The run parked at a wait. */
    readonly runId: string
}

/** One run parked at a wait, labelled for the page. */
export interface SandboxWaitingRunView {
    /** The run. */
    readonly runId: string
    /** The agent of the run. */
    readonly agentId: string
    /** The agent's name, else its id. */
    readonly agentLabel: string
    /** The person's name, else the contact, conversation or route id, else an empty text. */
    readonly personLabel: string
    /** The route the run is about: its context's route, else its conversation; null when it has none. */
    readonly routeId: string | null
    /** What the wait listens for: each trigger's verb, once, in order. */
    readonly waitsFor: ReadonlyArray<string>
    /** The park key of the wait. */
    readonly parkKey: string
    /** When the wait's time runs out (ISO 8601). */
    readonly dueAt: string
}

/** How "expire this run's wait now" ended (only an admitted expiry gets here). */
export interface SandboxWaitExpiryView {
    /** The run. */
    readonly runId: string
    /** The engine's word: `admitted`. */
    readonly outcome: string
}
