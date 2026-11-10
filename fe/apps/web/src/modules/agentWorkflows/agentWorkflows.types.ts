import type {
    AgentRunWorkflowsQuery,
    AgentWorkflowDiffQuery,
    AgentWorkflowQuery,
    AgentWorkflowsQuery,
    WorkflowTemplatesQuery,
} from "@/modules/api"
import type { StepsLocale } from "@/modules/workflowSteps"

/** One workflow of the agent as the list answers it. */
export type WorkflowWire = AgentWorkflowsQuery["agentWorkflows"][number]

/** One workflow with its graph, its history and its template diff as the back end answers it. */
export type WorkflowDetailWire = AgentWorkflowQuery["agentWorkflow"]

/** One version of the history. */
export type WorkflowVersionWire = WorkflowDetailWire["versions"][number]

/** How a graph differs from another, step by step, with both graphs. */
export type WorkflowDiffWire = AgentWorkflowDiffQuery["agentWorkflowDiff"]

/** One workflow template of the market. */
export type WorkflowTemplateWire = WorkflowTemplatesQuery["workflowTemplates"][number]

/** The workflow and version one run executes. */
export type RunPinWire = AgentRunWorkflowsQuery["agentRunWorkflows"][number]

/** The translator of the words of the workflows: a key and the values it embeds. */
export type WorkflowWords = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** What the views need beyond the wire: the words, and the clock of a moment. */
export interface WorkflowContext {
    readonly t: WorkflowWords
    /** The language the step cards are written in. */
    readonly locale: StepsLocale
    readonly has: (key: string) => boolean
    readonly dateOf: (iso: string) => string
}


export type {
    WorkflowDetailView,
    WorkflowDiffView,
    WorkflowMark,
    WorkflowNoticeView,
    WorkflowStatus,
    WorkflowTemplateDetailView,
    WorkflowTemplateRowView,
} from "@/modules/types"
