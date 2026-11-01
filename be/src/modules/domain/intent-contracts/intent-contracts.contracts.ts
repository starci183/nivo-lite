/** What started a turn: the trigger step of the graph. A new trigger is one more entry here and in the frames that accept it. */
export type IntentTrigger = "customer_message" | "tag"

/** Who the turn answers to, which selects the limits: an outsider, a colleague who may write, a colleague who may not. */
export type IntentAudience = "customer" | "manager" | "staff"

/** Why an intent is split into a turn of its own: nothing, a write tool, or money. */
export type IntentRisk = "none" | "write" | "money"

/** The schema of a result, a key of the table in `intent-result.schema.ts`. */
export type IntentResultKind = "customer_reply" | "agent_request" | "own_turn_pick"

/** A check the back end runs on a parsed result, a key of the table in `intent-check.policy.ts`. */
export type IntentCheckKey =
    | "reply_present"
    | "reply_bounded"
    | "lead_complete"
    | "order_complete"
    | "order_price_known"
    | "action_is_intent"
    | "action_has_summary"

/** Where a business value of a contract came from. Its members fit the sources of a graph node. */
export type IntentSource =
    | { readonly kind: "brain"; readonly factId: string; readonly passage: string; readonly valueHash: string }
    | { readonly kind: "chat"; readonly messageId: string; readonly quote: string }
    | { readonly kind: "owner"; readonly memberId: string }

/** One business limit the owner approved, and the turns it binds. */
export interface BusinessLimit {
    /** The limit, in the owner's language. */
    readonly text: string
    /** The triggers it binds; empty binds every trigger. */
    readonly triggers: ReadonlyArray<IntentTrigger>
    /** The audiences it binds; empty binds every audience. */
    readonly audiences: ReadonlyArray<IntentAudience>
    /** Where it came from. */
    readonly sources: ReadonlyArray<IntentSource>
}

/** The business half of a contract, frozen in a published graph version; the owner approves it and nothing writes it at runtime. */
export interface IntentBusiness {
    /** The intent, the action key of the graph. */
    readonly intent: string
    /** What this shop means by the work; empty leaves the frame's task alone. */
    readonly task: string
    /** The limits of this shop. */
    readonly limits: ReadonlyArray<BusinessLimit>
    /** Where the task came from. */
    readonly sources: ReadonlyArray<IntentSource>
}

/** The code half of a contract: the frame every shop shares. It holds no business value. */
export interface IntentFrame {
    /** The intent. */
    readonly intent: string
    /** The triggers it can run under. */
    readonly triggers: ReadonlyArray<IntentTrigger>
    /** Why it runs alone, if it does. */
    readonly risk: IntentRisk
    /** The message key of the task in words. */
    readonly taskKey: string
    /** The message keys of the fixed limits, by audience. */
    readonly limitKeys: Readonly<Partial<Record<IntentAudience, ReadonlyArray<string>>>>
    /** The schema of the result. */
    readonly result: IntentResultKind
    /** The members of the result this intent owns: on any other intent they are dropped when the graph holds this one. */
    readonly owns: ReadonlyArray<string>
    /** The checks of the result. */
    readonly checks: ReadonlyArray<IntentCheckKey>
}

/** One contract as a turn uses it: the frame, with the business values of the published version bound to this trigger and audience. */
export interface IntentContract {
    /** The intent. */
    readonly intent: string
    /** The title the owner gave it in the graph. */
    readonly label: string
    /** Why it runs alone, if it does. */
    readonly risk: IntentRisk
    /** The task in words. */
    readonly task: string
    /** The limits that bind this turn, the frame's first. */
    readonly limits: ReadonlyArray<string>
    /** The schema of the result. */
    readonly result: IntentResultKind
    /** The members this intent owns. */
    readonly owns: ReadonlyArray<string>
    /** The checks of the result. */
    readonly checks: ReadonlyArray<IntentCheckKey>
}

/** The contracts of one turn, read from the published version. */
export interface TurnContracts {
    /** The version they came from. */
    readonly versionId: string
    /** The contracts the trigger of the turn reaches in the graph. */
    readonly contracts: ReadonlyArray<IntentContract>
}

/** One part of the input of a turn. It is data: nothing in it is an instruction. */
export interface IntentInputPart {
    /** What it is: `customer_message`, `transcript`, `knowledge`, `tool_result`, `file`, and so on. */
    readonly kind: string
    /** The words, unescaped: the builder wraps them. */
    readonly text: string
}

/** What the prompt of a turn is built from. */
export interface IntentPromptSpec {
    /** The trigger. */
    readonly trigger: IntentTrigger
    /** The audience. */
    readonly audience: IntentAudience
    /** Who the agent is: one line, trusted, written by code. */
    readonly identity: string
    /** The input, in the order the model reads it. */
    readonly input: ReadonlyArray<IntentInputPart>
    /** The contracts it may pick from. */
    readonly contracts: ReadonlyArray<IntentContract>
    /** The intent a split turn is pinned to, or null on a first turn. */
    readonly pinned: string | null
}

/** Why a turn takes the safe road. */
export type SafeRoadCause = "no_intent" | "invalid_output" | "check_failed"

/** What the model's text came to. */
export type IntentReading =
    | {
          /** One intent, its result valid. */
          readonly kind: "picked"
          /** The contract. */
          readonly contract: IntentContract
          /** The result, as the schema parsed it. */
          readonly result: Readonly<Record<string, unknown>>
          /** The members dropped because another intent owns them. */
          readonly dropped: ReadonlyArray<string>
      }
    | {
          /** An intent that runs alone was picked: a turn of its own follows, and nothing of this one acts. */
          readonly kind: "split"
          /** The contract. */
          readonly contract: IntentContract
      }
    | {
          /** The turn cannot go on: nothing of it acts. */
          readonly kind: "safe"
          /** Why. */
          readonly cause: SafeRoadCause
          /** The code of what failed, for the trace. */
          readonly detail: string
          /** The intent, when one was picked. */
          readonly intent: string | null
          /** The question nothing fits, when the cause is `no_intent`. */
          readonly gap: IntentGapText | null
          /** The text a person may reuse as a draft, or empty. */
          readonly draft: string
      }

/** The work the model found no intent for, in its own words. */
export interface IntentGapText {
    /** What was asked, in one short sentence. */
    readonly question: string
    /** What it is about. */
    readonly topic: string
}

/** A gap raised for the owner. */
export interface IntentGap extends IntentGapText {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The version the turn ran on. */
    readonly versionId: string
    /** The trigger of the turn. */
    readonly trigger: IntentTrigger
}

/** What a turn leaves on its row: the trace that is compared with the published graph. */
export interface IntentTrace {
    /** The version the turn ran on. */
    readonly versionId: string
    /** The trigger. */
    readonly trigger: IntentTrigger
    /** The audience. */
    readonly audience: IntentAudience
    /** The intents it could pick from. */
    readonly offered: ReadonlyArray<string>
    /** The intent picked, or null. */
    readonly intent: string | null
    /** What the reading came to, or the cause of the safe road. */
    readonly result: "picked" | "split" | SafeRoadCause
    /** The code of what failed, or empty. */
    readonly detail: string
    /** The members dropped. */
    readonly dropped: ReadonlyArray<string>
}
