import type { ModuleDefinition } from "@modules/domain/modules"
import type { HistoryCompletedTask, HistoryStepThread, HistoryThreadLead } from "./decision-history.contracts"
import type { InboundStatus, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import type { OptionalText, OutboundAccess } from "./work-engine.contracts"

/** The one door to the channel inputs: the engine reports where an input stands. The app root binds it to the inbox capability. */
export interface InboundEventStatus {
    /** Sets the status of an inbound event; `leadId` links the customer the engine found when it is not null. */
    mark(ctx: WorkContext, inboundEventId: string, status: InboundStatus, leadId: OptionalText): Promise<void>
}

/** The one door to the lead generation flow, whose steps chain by their own state machine. */
export interface LeadGenFlow {
    /** Queues what follows a finished lead generation item. */
    continueAfter(ctx: WorkContext, item: WorkItem): Promise<void>
}

/** The customer a lead names, as a decision note quotes it. */
export interface DecisionLead {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The channel label. */
    readonly channel: string
}

/** The one door to the leads: the decision log names the customer of a settled card. The app root binds it to the leads capability. */
export interface LeadDirectory {
    /** One lead of the workspace; an unknown or foreign id raises the owner's not-found error. */
    require(workspaceId: string, leadId: string): Promise<DecisionLead>
}

/** The one door to the channel connections: how far the item's agent may act on the connection the message would leave through. */
export interface OutboundAccessGate {
    /**
     * The access of the item's department agent on the connection of the conversation named in the proposal, else of the
     * customer's latest conversation; "auto" when there is no connection (website chat) or nothing is bound.
     */
    accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess>
}

/** The one door to the catalogue of modules: which modules exist and which actions each performs. The app root binds it to the modules capability. */
export interface ModuleCatalogSource {
    /** The catalogue, its modules in display order. */
    catalog(): Promise<{ readonly modules: ReadonlyArray<ModuleDefinition> }>
}

/** The one door to what agents' work in threads is linked to: the history keeps the verdicts the engine did not log. The app root binds it to the thread-work capability. */
export interface ThreadWorkHistory {
    /** Which of the given approval requests an agent's work waits on. */
    linkedRequestIds(workspaceId: string, requestIds: ReadonlyArray<string>): Promise<Array<string>>
    /** Which of the given threads an agent's work still runs in. */
    workingThreadIds(workspaceId: string, threadIds: ReadonlyArray<string>): Promise<Array<string>>
}

/** The one door to the work chains: the history names the thread of a step and lists the tasks members completed. The app root binds it to the work-chains capability. */
export interface WorkChainsHistory {
    /** The thread of each given step. */
    threadsOfSteps(workspaceId: string, stepIds: ReadonlyArray<string>): Promise<Array<HistoryStepThread>>
    /** The tasks members completed, newest first, a bounded page. */
    completedTasks(workspaceId: string, skip: number, limit: number): Promise<Array<HistoryCompletedTask>>
}

/** The one door to the work threads: the history names the customer of a thread. The app root binds it to the work-threads capability. */
export interface WorkThreadsHistory {
    /** The customer of each given thread. */
    leadsOf(workspaceId: string, threadIds: ReadonlyArray<string>): Promise<Array<HistoryThreadLead>>
}
