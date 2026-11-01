import type { Installation } from "@modules/domain/agents"
import type {
    InboundTrust,
    IntentContract,
    IntentGapText,
    IntentInputPart,
    IntentTrace,
    IntentTrigger,
    SafeRoadCause,
    TurnContracts,
} from "@modules/domain/intent-contracts"
import type { SubjectType } from "@modules/domain/work-items"
import type { RunUsage } from "@modules/integrations/openclaw"
import type { AgentTurnView, AgentWakeSource } from "@modules/domain/agent-work"
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

/** What a tag or background turn answers. */
export interface InternalProposal {
    /** What to say; empty when there is nothing to say. */
    readonly reply: string
    /** Changes to the agent's own task list. */
    readonly tasks: ReadonlyArray<InternalTaskOp>
    /** Requests to do work. */
    readonly actions: ReadonlyArray<InternalAction>
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
    /** The turn this context is for; with the agent's name it lets the context be the contract prompt when the graph holds contracts. */
    readonly wake?: AgentTurnView
    /** The agent's display name, the one trusted line of the contract prompt. */
    readonly agentName?: string
}

/** What came of one action of a proposal. */
export type InternalActionResult =
    | { readonly index: number; readonly action: string; readonly outcome: "requested"; readonly workItemId: string }
    | { readonly index: number; readonly action: string; readonly outcome: "dropped"; readonly reason: string }

/** A proposal the settler applied. */
export interface SettledProposal {
    /** It was applied. */
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
    /** The trace of a turn on the contract pipeline, as a member of the turn's outcome; absent on a turn without contracts. */
    readonly traced?: IntentTraced
}

/** The lease had moved on, so nothing was written or requested. */
export interface StaleProposal {
    /** It was not applied. */
    readonly kind: "stale"
}

/** What the settler did with a proposal. */
export type InternalSettled = StaleProposal | SettledProposal

/** The trace of a pipeline turn, named as the member of the outcome it becomes. */
export interface IntentTraced {
    /** The trace. */
    readonly intent: IntentTrace
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

/** What a turn on the contract pipeline settles against: the version, the trigger, the trust and the contracts it was offered. */
export interface IntentPlan {
    /** The published version the contracts came from. */
    readonly versionId: string
    /** What started the turn. */
    readonly trigger: IntentTrigger
    /** Who the turn answers to. */
    readonly trust: InboundTrust
    /** The intent a split turn is pinned to, or null on a first turn. */
    readonly pinned: string | null
    /** The contracts the turn may pick from: one when pinned. */
    readonly contracts: ReadonlyArray<IntentContract>
}

/** What the pipeline needs to know about a wake to find the contracts of its turn. */
export interface IntentScope {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** The account that wrote the tagging message, or null: it decides the trust of a tag. */
    readonly authorUserId: string | null
    /** The intent a split turn is pinned to, or null. */
    readonly pinned: string | null
}

/** The plan of a pipeline turn with the prompt built from it. */
export interface IntentTurnPlan extends IntentPlan {
    /** The whole message of the turn. */
    readonly prompt: string
}

/** The turn and wake a proposal settles for: what a stored step row carries, so a step can settle from the row alone. */
export interface InternalWakeRef {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The wake. */
    readonly wakeId: string
    /** The turn row. */
    readonly turnId: string
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** The account that wrote the tagging message, or null. */
    readonly authorUserId: string | null
}

/** What the model's text came to, as a step row keeps it: the result of a picked intent is the text a door reads. */
export type IntentReadingRow =
    | {
          /** One intent, its result valid. */
          readonly kind: "picked"
          /** The contract. */
          readonly contract: IntentContract
          /** The result, as JSON text. */
          readonly resultText: string
          /** The members dropped because another intent owns them. */
          readonly dropped: ReadonlyArray<string>
      }
    | {
          /** An intent that runs alone was picked. */
          readonly kind: "split"
          /** The contract. */
          readonly contract: IntentContract
      }
    | {
          /** The turn cannot go on. */
          readonly kind: "safe"
          /** Why. */
          readonly cause: SafeRoadCause
          /** The code of what failed. */
          readonly detail: string
          /** The intent, when one was picked. */
          readonly intent: string | null
          /** The question nothing fits, when the cause is `no_intent`. */
          readonly gap: IntentGapText | null
          /** The text a person may reuse as a draft, or empty. */
          readonly draft: string
      }

/** What a turn read came to. */
export interface IntentRead {
    /** The reading of the model's text. */
    readonly reading: IntentReadingRow
    /** The trace that goes on the turn's outcome. */
    readonly trace: IntentTrace
}

/** The wake and turn a door acts for, as a step row keeps it. */
export interface WakeRow {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The lock scope. */
    readonly scopeKey: string
    /** The wake. */
    readonly wakeId: string
    /** The turn row. */
    readonly turnId: string
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** The fact's key. */
    readonly eventKey: string
    /** Ids and flags of the fact. */
    readonly context: Readonly<Record<string, string | boolean>>
    /** The member behind the wake. */
    readonly actorMemberId: string | null
    /** The attempt. */
    readonly attempts: number
    /** The attempts the wake may have. */
    readonly maxAttempts: number
    /** When the wake was written, as ISO text. */
    readonly wakeCreatedAt: string
}

/** The input of a door step. */
export interface DoorInput {
    /** The money evidence of the turn's files, as JSON text. */
    readonly moneyText?: string | undefined
    /** The wake. */
    readonly wake: WakeRow
    /** The reading. */
    readonly reading: IntentReadingRow
    /** The trace. */
    readonly trace: IntentTrace
}

/** What the settler needs of a tag turn to act from a row alone. */
export interface TagDoorInput extends DoorInput {
    /** The agent, the actor and the language the proposal is applied under. */
    readonly settle: InternalSettleInput
}

/** What a door answers: the members its step stores. */
export interface IntentDoorResult {
    /** Any member. */
    readonly [key: string]: unknown
}

/** The intent a wake is pinned to, or none. */
export type OptionalIntent = string | null

/** The contracts of a turn, or none. */
export type OptionalTurnContracts = TurnContracts | null

/** The plan of a turn on the pipeline, or none. */
export type OptionalIntentPlan = IntentPlan | null

/** The node keys of the published graph a pipeline turn's steps stand for. */
export interface IntentNodeKeys {
    /** The node of the trigger path where the turn picks what to do. */
    readonly turn: string
    /** The act node of each intent the graph holds, by intent. */
    readonly acts: Readonly<Record<string, string>>
}

/** Where the files of a turn are: the message a customer or a colleague wrote. */
export interface IntentFileRef {
    /** The workspace. */
    readonly workspaceId: string
    /** Whether a customer's message or a colleague's tag holds them. */
    readonly kind: "customer" | "tag"
    /** The customer conversation, or null for a tag. */
    readonly conversationId: string | null
    /** The message that holds them, or null when the wake names none. */
    readonly messageId: string | null
    /** The work thread of a tag, or null. */
    readonly threadId: string | null
}

/** A picture or file sent to the model with the turn. */
export interface IntentAttachment {
    /** The name of the file. */
    readonly fileName: string
    /** The type of the file. */
    readonly mimeType: string
    /** The bytes, in base64. */
    readonly content: string
}

/** The money a file turned up, as the graph's own shape holds it: passed through, never read here. */
export interface IntentMoney {
    /** Any member. */
    readonly [key: string]: unknown
}

/** What the files of a message add to a turn. */
export interface IntentFileBundle {
    /** The read of each file, as data parts of the input. */
    readonly parts: ReadonlyArray<IntentInputPart>
    /** The files themselves, for the model to see. */
    readonly attachments: ReadonlyArray<IntentAttachment>
    /** The money evidence of the files, or null. */
    readonly money: IntentMoney | null
}

/** The attachments a plan carries, or none: spread into the plan of the turn. */
export interface IntentPlanFiles {
    /** The files, when the message holds any. */
    readonly attachments?: ReadonlyArray<IntentAttachment>
}

/** What a door row holds besides the wake, the reading and the trace. */
export interface IntentDoorExtra {
    /** The agent, the actor and the language a tag's proposal is applied under. */
    readonly settle?: InternalSettleInput
    /** The money evidence of the turn's files, as JSON text. */
    readonly moneyText?: string
}
