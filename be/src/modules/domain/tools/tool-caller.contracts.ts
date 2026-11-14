import type { ToolJson } from "@modules/domain/tool-receipts"
import type { Locale } from "@modules/platform/i18n"
import type { ToolManifest } from "./tool-manifest.contracts"
import type { NodeAccountChoice } from "@modules/domain/graph-nodes"
import type { CallerOrigin } from "./right-origin.contracts"

/** A lead id, or null when there is none. */
export type OptionalLeadId = string | null

/**
 * Which lead a conversation belongs to, supplied by the owner of conversations (bound at the app root): the NIVO effect tools pin a
 * step's `conversationId` and `leadId` arguments to the conversation or the lead of its run with it.
 */
export interface ConversationLeadsGate {
    /** The lead of the conversation, or null when it has none or does not exist in the workspace. */
    leadOf(workspaceId: string, conversationId: string): Promise<OptionalLeadId>
}

/** The graph step a gateway call runs in, as the run token the host minted says it; absent for any caller outside a node run. */
export interface ToolRun {
    /** The run (the agent turn). */
    readonly turnId: string
    /** The language the run writes in. */
    readonly locale: Locale
    /** Who the run acts for. */
    readonly origin: "customer" | "owner" | "staff" | "system"
    /** The member behind the turn, when a person is. */
    readonly memberId: string | null
    /** The agent that handed its conversation to this run, or null. */
    readonly handedOffBy: string | null
    /** The contact (the person) the run serves, or null. */
    readonly contactId?: string | null | undefined
    /**
     * The sales lead a module resolved as the run's subject when it serves no conversation of its own (a workflow call, a timer), or
     * null: the bridge of the pin of module effects that still name a `leadId` argument.
     */
    readonly leadId: string | null
    /** The tools the step may call: the node's declared `tools` that the run's grant holds. */
    readonly stepTools: ReadonlyArray<string>
}

/** Who calls the gateway; where its call came from (`CallerOrigin`) is a label of the audit and decides nothing. */
export interface ToolCaller extends CallerOrigin {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The customer conversation the call serves, or null. */
    readonly conversationId: string | null
    /** The work item the call serves, or null. */
    readonly workItemId: string | null
    /**
     * Who the caller's agent talks to: `customer` for a customer-facing or publishing module (or one the catalogue does not know),
     * `internal` otherwise. A caller that does not say (a performer NIVO runs itself) is internal; the agent door always says.
     */
    readonly audience?: "customer" | "internal"
    /** The person who approved this exact call, when it replays an approval. */
    readonly approvedBy?: string
    /**
     * The stable key of the step this call is (for example `<workItemId>:<step>` or the inbound message id): a re-run of the
     * same step passes the same key. A side-effect remote call derives its replay key from it, else from the work item.
     */
    readonly opKey?: string | undefined
    /** The agent turn the call runs in (the bridge of a running turn knows it); the agent door has none; a module's declared job names its own job run. */
    readonly turnId?: string | undefined
    /**
     * The business key of the effect the call is, when its caller has one beside the step key (the `onceBy` of a graph step; a declared
     * job's own key for the thing it does, such as the id of the line it delivers): one effect per key in the workspace.
     */
    readonly onceBy?: string | undefined
    /** The member of the shop who typed what a module's declared job says (a reply typed in the workbench), recorded on the customer line it sends; absent for every other call. */
    readonly byMember?: string | undefined
    /** The graph step the call runs in, when a node run makes it through the node tool door; absent otherwise. */
    readonly run?: ToolRun | undefined
    /**
     * True when the call is a step of a workflow, made through the node tool door under a token the host minted. The conversation of
     * such a caller is the one its RUN carries (whoever started it), not a customer the agent answers freely: a tool for internal use
     * is then judged by the audience of the step's agent alone.
     */
    readonly graphStep?: true | undefined
    /**
     * True for the engine's own caller: a module's declared job run as the workspace's internal agent. It is code, not an agent an
     * owner attaches to providers, so the provider abilities do not judge it; its fixed door grants and its grant rows do.
     */
    readonly engine?: true | undefined
    /** The connected account the call acts on, when the tool runner handed one; absent, the provider's adapter picks as before. */
    readonly connectionId?: string | undefined
    /** The provider of that account. */
    readonly provider?: string | undefined
    /** Which try of the call this is on the account (from 1), for the audit; absent for a call the runner handed no account. */
    readonly attempt?: number | undefined
    /** How the account was chosen, for the audit. */
    readonly chosenBy?: NodeAccountChoice | undefined
}

/** One provider's part of a tool answered per provider, as the gateway let it through. */
export interface ProviderPart {
    /** The provider key of the part (`sepay`, `zalo_oa`, `telegram`). */
    readonly provider: string
}

/** Who a native tool runs for: the agent, the customer conversation when the call serves one, and where the gateway call came from. */
export interface NativeCaller extends CallerOrigin {
    /** The agent. */
    readonly agentId: string
    /** The customer conversation the call serves, or null. */
    readonly conversationId: string | null
    /** The stable key of the step the call is, when the caller has one. */
    readonly opKey?: string | undefined
    /** The job run or turn the call is made in, when its caller names one (a module's declared job names its run). */
    readonly turnId?: string | undefined
    /** The business key of the effect, when the caller has one beside the step key. */
    readonly onceBy?: string | undefined
    /** The member of the shop who typed what a declared job says, when the job names one. */
    readonly byMember?: string | undefined
    /**
     * The person who approved this exact call, when it replays an approval: the gateway's own fact about the call (the approving
     * member of the approved replay), never anything the arguments say. Absent for a call nobody approved.
     */
    readonly approvedBy?: string | undefined
    /** The graph step the call runs in, when a node run makes it; absent otherwise. */
    readonly run?: ToolRun | undefined
    /** True when the call is a step of a workflow: the conversation is the run's, and the agent's own audience judges an internal tool. */
    readonly graphStep?: true | undefined
    /**
     * True for the engine's own caller (a module's declared job run as the workspace's internal agent): it is internal by what it is,
     * whatever the catalogue says of its agent's module.
     */
    readonly engine?: true | undefined
    /**
     * For a tool answered per provider only: the parts the gateway judged the caller may see, each with its data right. Set by the
     * gateway, never by a caller; absent for every other tool.
     */
    readonly parts?: ReadonlyArray<ProviderPart> | undefined
    /** The connected account the call acts on, when the tool runner handed one: the adapter prefers it and keeps its own pick without it. */
    readonly connectionId?: string | undefined
    /** The provider of that account. */
    readonly provider?: string | undefined
}

/**
 * A native connector: its manifest and how it runs a tool. An adapter that needs no caller declares the three-parameter form; one
 * that answers for the agent's view (module, instance, audience) takes the caller.
 */
export interface NativeToolFamily {
    /** The manifest. */
    readonly manifest: ToolManifest
    /** Runs one tool for a workspace, for the caller. An expected refusal is a `NativeRefused` error, which is an answer. */
    invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson>
}
