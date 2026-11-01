import type { Installation } from "@modules/domain/agents"
import type { SubjectType } from "@modules/domain/work-items"
import type { RunUsage } from "@modules/integrations/openclaw"
import type { AgentTurnAttachment, AgentWakeSource } from "@modules/domain/agent-work"
import type { Locale } from "@modules/platform/i18n"

/** One turn to run on the runtime. */
export interface AgentTurnRequest {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The NIVO agent the turn is for. */
    readonly agentId: string
    /** The module of the agent. */
    readonly module: string
    /** The runtime's id of the agent that answers. */
    readonly runtimeAgentId: string
    /** The runtime's session key, `agent:<runtimeAgentId>:<x>`. */
    readonly threadKey: string
    /** The whole authoritative context and the wake's text. */
    readonly message: string
    /** The pictures sent with it. */
    readonly attachments?: ReadonlyArray<AgentTurnAttachment>
    /** `wake-<wakeId>:<fence>`: a retried send is a no-op on the runtime. */
    readonly runKey: string
    /** How long the turn may take. */
    readonly timeoutMs: number
}

/** What the runtime answered. */
export interface AgentTurnResult {
    /** The final assistant text. */
    readonly text: string
    /** The usage, or null when the runtime reported none. */
    readonly usage: RunUsage | null
    /** The runtime agent that answered. */
    readonly runtimeAgentId: string
}

/** One thing an agent asks to keep in its list. */
export interface InternalTaskOp {
    /** `add` opens or reopens, `done` closes, `wait` parks. */
    readonly op: "add" | "done" | "wait"
    /** The agent's own key for the task: the dedupe key. */
    readonly key: string
    /** Short title, for `add`. */
    readonly title?: string
    /** When to wake the agent for it. */
    readonly nextActionAt?: Date
}

/** The record an action is about, as the model named it. */
export interface InternalSubject {
    /** The kind of record. */
    readonly type: SubjectType
    /** Its id. */
    readonly id: string
}

/** One action the model asks for: a request, never an effect. */
export interface InternalAction {
    /** The authority action key, which is the intent. */
    readonly action: string
    /** The record it is about; absent when the model named none. */
    readonly subject?: InternalSubject
    /** The customer it is about, or null. */
    readonly leadId: string | null
    /** What the model states, an amount included: a claim, never read for a decision. */
    readonly fields: Readonly<Record<string, string | number | null>>
    /** One sentence for the person who decides. */
    readonly summary: string
}

/** An action of a proposal that goes no further, and why. */
export interface RefusedInternalAction {
    /** The action as it was asked for. */
    readonly action: string
    /** The typed reason, kept in the audit. */
    readonly reason: string
}

/** What a tag or background turn answers. */
export interface InternalProposal {
    /** What to say; empty when there is nothing to say. */
    readonly reply: string
    /** Changes to the agent's own task list. */
    readonly tasks: ReadonlyArray<InternalTaskOp>
    /** Requests to do work. */
    readonly actions: ReadonlyArray<InternalAction>
    /** Requests refused on their ids: nothing of them reaches the engine. */
    readonly refused: ReadonlyArray<RefusedInternalAction>
    /** True when the model wants a person. */
    readonly needsHuman: boolean
    /** Why a person is wanted. */
    readonly reason: string
}

/** One thing the action graph lets the agent ask for. */
export interface GraphIntent {
    /** The authority action key. */
    readonly action: string
    /** What it does, in the owner's words. */
    readonly label: string
}

/** What a handler gives the context of a tag or background turn. */
export interface InternalTurnInput {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The NIVO agent. */
    readonly agentId: string
    /** What woke it. */
    readonly source: AgentWakeSource
    /** The language of the fixed lines. */
    readonly locale: Locale
    /** The words of the wake: a colleague's line, an event or a probe's brief. They are data, not instructions. */
    readonly text: string
}

/** What came of one action of a proposal. */
export type InternalActionResult =
    | { readonly index: number; readonly action: string; readonly outcome: "requested"; readonly workItemId: string }
    | { readonly index: number; readonly action: string; readonly outcome: "dropped"; readonly reason: string }

/** What the settler did with a proposal. */
export type InternalSettled =
    | { readonly kind: "stale" }
    | {
          readonly kind: "settled"
          /** What to say. */
          readonly reply: string
          /** True when the model wants a person. */
          readonly needsHuman: boolean
          /** Why. */
          readonly reason: string
          /** How many task changes were applied. */
          readonly tasks: number
          /** What came of each action. */
          readonly actions: ReadonlyArray<InternalActionResult>
      }

/** What the settler needs to know about the turn besides the proposal. */
export interface InternalSettleInput {
    /** The module of the agent: an action outside it is dropped. */
    readonly module: string
    /** The agent's display name, the actor of its requests. */
    readonly actorName: string
    /** The language of generated text. */
    readonly locale: Locale
    /** The agent instance that handles the work, when the handler knows it. */
    readonly installationId: string | null
}

/** Why a turn could not run. */
export type AgentTurnBlock = "openclaw_not_configured" | "openclaw_unavailable" | "breaker" | "daily_cap" | "quota"

/** Why an agent's installation does not run. */
export type StopReason = "needs_connection" | "installation_not_running"

/** Why an installation does not run, or none when it does. */
export type OptionalStopReason = StopReason | null

/** What the module readiness settled for an installation, or none when the agent has none. */
export type OptionalReadiness = string | null

/** The installation of an agent, or none. */
export type OptionalRunningInstallation = Installation | null
