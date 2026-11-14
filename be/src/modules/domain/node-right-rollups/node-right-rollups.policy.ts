import { nodeAccountRequestsOf, type GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { StandingRight, WorkflowRightsStanding } from "@modules/domain/agent-graphs"
import { PROVIDER_CATALOGUE } from "@modules/domain/tools"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import type { ProviderOffer } from "@modules/domain/provider-offer"
import type {
    AgentNodeRights,
    AgentRightAccount,
    AgentRightRow,
    ProviderRightCounts,
    ProviderRightHolders,
    ProviderToolRight,
    ProviderTriggerRight,
    RightHolder,
    RightOperation,
    RollupWords,
    TemplateNodeRequests,
    TriggerHolder,
} from "./node-right-rollups.contracts"

/** One tool as a provider's offer documents it. */
type OfferedTool = ProviderOffer["mcp"][number]

/** An operation of an account's pinned document that no plugin opened as a tool. */
export interface ClosedOperation {
    /** The operation id of the document. */
    readonly operationId: string
    /** Its HTTP method. */
    readonly method: string
    /** Its path. */
    readonly path: string
}

/** The decider of one trigger of an account, as its switch states it. */
export interface TriggerDecider {
    /** The trigger. */
    readonly name: string
    /** The agent that decides on its events, or null when none is bound. */
    readonly agentId: string | null
}

/** The title of a step by its id, as its installed node declares it; null for a step no installed node is. */
export type StepTitleOf = (step: string) => RollupWords | null

/** What the agent's rights page is made of. */
export interface AgentRightsParts {
    /** The agent. */
    readonly agentId: string
    /** The accounts the agent is attached to. */
    readonly attachments: ReadonlyArray<ProviderAttachmentView>
    /** The name of each connected account, by id. */
    readonly names: ReadonlyMap<string, string>
    /** What the provider of each attached account offers, by connection id. */
    readonly offers: ReadonlyMap<string, ProviderOffer>
    /** What the agent's running workflows ask for. */
    readonly standing: ReadonlyArray<WorkflowRightsStanding>
    /** The declared title of a step. */
    readonly stepTitleOf: StepTitleOf
}

/** What a provider's rights tab is made of. */
export interface ProviderHoldersParts {
    /** What the provider of the account offers. */
    readonly offer: ProviderOffer
    /** The operations of the account's pinned document no plugin opened. */
    readonly closed: ReadonlyArray<ClosedOperation>
    /** What every running workflow of the workspace asks for. */
    readonly standing: ReadonlyArray<WorkflowRightsStanding>
    /** The name of each agent, by id. */
    readonly agentNames: ReadonlyMap<string, string>
    /** The agents attached to the account. */
    readonly attached: ReadonlySet<string>
    /** The decider of each trigger of the account. */
    readonly deciders: ReadonlyArray<TriggerDecider>
    /** The declared title of a step. */
    readonly stepTitleOf: StepTitleOf
}

/** A tool of an offer as a rights row names it. */
export const operationOf = (tool: OfferedTool): RightOperation => ({
    id: tool.id,
    title: tool.title,
    method: tool.operation?.method ?? null,
    path: tool.operation?.path ?? null,
    kind: tool.kind,
    effect: tool.effect,
})

/** An operation no offer documents, named by its id: a tool the provider no longer serves, taken as a write, titled by nothing. */
const bareOperationOf = (id: string): RightOperation => ({
    id,
    title: null,
    method: null,
    path: null,
    kind: "write",
    effect: null,
})

/** How a node calls an operation, as both roll-ups label it: the node's one declared mode, and the version that runs it. */
const standingOf = (workflow: WorkflowRightsStanding, entry: StandingRight) => ({
    mode: entry.mode,
    versionNumber: workflow.versionNumber,
})

/** An operation of a pinned document that is no tool: its method and path, a GET as a read, no mark claimed. */
const closedOperationOf = (closed: ClosedOperation): RightOperation => ({
    id: closed.operationId,
    title: null,
    method: closed.method,
    path: closed.path,
    kind: closed.method === "GET" ? "read" : "write",
    effect: null,
})

const kindOf = (provider: string): string | null =>
    PROVIDER_CATALOGUE.find((spec) => spec.provider === provider)?.kind ?? null

/** The page of an agent: its attached accounts with how many running steps use each, and one row per operation its nodes call. */
export const agentRightsOf = (parts: AgentRightsParts): AgentNodeRights => {
    const entries = parts.standing.flatMap((workflow) => workflow.entries.map((entry) => ({ workflow, entry })))
    const operations = new Map(
        [...parts.offers.values()].flatMap((offer) =>
            offer.mcp.map((tool): readonly [string, RightOperation] => [
                JSON.stringify([offer.connectionId, tool.id]),
                operationOf(tool),
            ]),
        ),
    )
    const accounts = parts.attachments.map((attachment): AgentRightAccount => {
        const steps = new Set(
            entries
                .filter(({ entry }) => entry.connectionId === attachment.connectionId)
                .map(({ workflow, entry }) => JSON.stringify([workflow.workflowId, entry.nodeKey])),
        )
        return {
            connectionId: attachment.connectionId,
            provider: attachment.provider,
            kind: kindOf(attachment.provider),
            name: parts.names.get(attachment.connectionId) ?? "",
            stepsUsing: steps.size,
            operations: (parts.offers.get(attachment.connectionId)?.mcp ?? []).map((tool) => operationOf(tool)),
        }
    })
    const rows = entries.map(({ workflow, entry }): AgentRightRow => {
        const step = workflow.graph.nodes.find((node) => node.key === entry.nodeKey)?.step ?? ""
        return {
            operation:
                operations.get(JSON.stringify([entry.connectionId, entry.operation])) ??
                bareOperationOf(entry.operation),
            connectionId: entry.connectionId,
            ...standingOf(workflow, entry),
            workflowId: workflow.workflowId,
            workflowKey: workflow.workflowKey,
            workflowName: workflow.workflowName,
            nodeKey: entry.nodeKey,
            step,
            stepTitle: parts.stepTitleOf(step),
        }
    })
    return { agentId: parts.agentId, accounts, rows }
}

/** The steps that ask for one operation on the account, as holders. */
const holdersOf = (parts: ProviderHoldersParts, operation: string): ReadonlyArray<RightHolder> =>
    parts.standing.flatMap((workflow) =>
        workflow.entries
            .filter((entry) => entry.connectionId === parts.offer.connectionId && entry.operation === operation)
            .map((entry) => {
                const step = workflow.graph.nodes.find((node) => node.key === entry.nodeKey)?.step ?? ""
                return {
                    agentId: workflow.agentId,
                    agentName: parts.agentNames.get(workflow.agentId) ?? "",
                    workflowId: workflow.workflowId,
                    workflowKey: workflow.workflowKey,
                    workflowName: workflow.workflowName,
                    nodeKey: entry.nodeKey,
                    step,
                    stepTitle: parts.stepTitleOf(step),
                    ...standingOf(workflow, entry),
                }
            }),
    )

/** The figures of the filter tabs over the tool rows; a row is held when a step holds it. */
export const rightCountsOf = (tools: ReadonlyArray<ProviderToolRight>): ProviderRightCounts => {
    const held = tools.filter((row) => row.holders.length > 0).length
    return {
        all: tools.length,
        held,
        unheld: tools.length - held,
        writes: tools.filter((row) => row.operation.kind === "write").length,
    }
}

/**
 * The agents one trigger of the account wakes: each attached agent whose running workflow registers on it (on this account or on
 * any account of the provider), as the decider when it is the one bound to decide and as told otherwise; and the bound decider
 * itself when no workflow of it registers. A registering workflow is named with the step an event starts: its first node.
 */
const triggerHoldersOf = (parts: ProviderHoldersParts, name: string): ReadonlyArray<TriggerHolder> => {
    const { connectionId, provider } = parts.offer
    const decider = parts.deciders.find((entry) => entry.name === name)?.agentId ?? null
    const registered = parts.standing
        .filter((workflow) => parts.attached.has(workflow.agentId))
        .filter((workflow) =>
            (workflow.graph.triggers ?? []).some(
                ({ source }) =>
                    source.kind === "provider" &&
                    source.provider === provider &&
                    source.trigger === name &&
                    (source.connectionId === null || source.connectionId === connectionId),
            ),
        )
        .map((workflow): TriggerHolder => {
            const first = workflow.graph.nodes.at(0)
            return {
                agentId: workflow.agentId,
                agentName: parts.agentNames.get(workflow.agentId) ?? "",
                role: workflow.agentId === decider ? "decider" : "notice",
                workflowId: workflow.workflowId,
                workflowName: workflow.workflowName,
                workflowKey: workflow.workflowKey,
                nodeKey: first?.key ?? null,
                step: first?.step ?? null,
                stepTitle: first === undefined ? null : parts.stepTitleOf(first.step),
            }
        })
    if (decider === null || registered.some((holder) => holder.agentId === decider)) return registered
    const bound: TriggerHolder = {
        agentId: decider,
        agentName: parts.agentNames.get(decider) ?? "",
        role: "decider",
        workflowId: null,
        workflowName: null,
        workflowKey: null,
        nodeKey: null,
        step: null,
        stepTitle: null,
    }
    return [bound, ...registered]
}

/**
 * The rights tab of a connected account: one row per tool of its provider (held or not), then the operations of its pinned document
 * that no plugin opened (nobody can hold them), the reads every member holds, and the triggers with the agents they wake.
 */
export const providerHoldersOf = (parts: ProviderHoldersParts): ProviderRightHolders => {
    const { offer } = parts
    const open = offer.mcp.map((tool): ProviderToolRight => ({
        operation: operationOf(tool),
        open: true,
        holders: holdersOf(parts, tool.id),
    }))
    const closed = parts.closed.map((operation): ProviderToolRight => ({
        operation: closedOperationOf(operation),
        open: false,
        holders: [],
    }))
    const tools = [...open, ...closed]
    const triggers = offer.triggers.map((trigger): ProviderTriggerRight => ({
        name: trigger.name,
        summary: trigger.summary,
        holders: triggerHoldersOf(parts, trigger.name),
    }))
    return {
        connectionId: offer.connectionId,
        provider: offer.provider,
        tools,
        counts: rightCountsOf(tools),
        screens: offer.api.map((read) => ({ name: read.name, summary: read.summary, everyMember: true })),
        triggers,
    }
}

/** What a template version's nodes ask for on accounts, as the template states them (node, account kind, operation, the node's declared mode). */
export const templateRequestsOf = (
    templateId: string,
    version: number,
    graph: Pick<GraphSpec, "nodes">,
): TemplateNodeRequests => {
    const rights = nodeAccountRequestsOf(graph.nodes).map((row) => ({
        nodeKey: row.nodeKey,
        kind: row.kind,
        provider: row.provider,
        operation: row.operation,
        mode: row.mode,
    }))
    return {
        templateId,
        version,
        rights,
        count: rights.length,
        askCount: rights.filter((row) => row.mode === "ask").length,
    }
}
