import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { latestTemplateVersion, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import type { Locale } from "@modules/platform/i18n"
import type {
    SnapshotDiff,
    TemplateChangeLines,
    TemplatePreview,
    WorkflowDetail,
    WorkflowVersionView,
    WorkflowView,
} from "../agent-workflows.contracts"
import type { NodeRightAsk, OptionalStepTitle } from "../agent-workflow-rights.contracts"
import { operationTitleOf, type OptionalOperationTitle } from "./node-accounts.policy"
import { linkedGraphOf } from "./workflow-view.policy"

/** A workflow as the GraphQL transport sends it. */
export interface WorkflowWire {
    /** The workflow. */
    readonly id: string
    /** The stable key within the agent. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** active, draft or paused. */
    readonly status: string
    /** Whether it is the agent's main workflow. */
    readonly primary: boolean
    /** The number of the version that runs, or null. */
    readonly activeNumber: number | null
    /** The newest version number. */
    readonly latestNumber: number
    /** The template it came from, or null. */
    readonly templateId: string | null
    /** The template version it copied or last accepted, or null. */
    readonly templateVersion: number | null
    /** The template's name, or null. */
    readonly templateName: string | null
    /** The template's newest version, or null. */
    readonly templateLatest: number | null
    /** How many steps the version that runs differs from its template version, or null. */
    readonly templateChangedSteps: number | null
    /** How many steps the version that runs has. */
    readonly stepCount: number
    /** When it last changed, ISO. */
    readonly updatedAt: string
}

/** A workflow version as the transport sends it. */
export interface WorkflowVersionWire {
    /** The version. */
    readonly id: string
    /** The number within the workflow. */
    readonly number: number
    /** How it came to be. */
    readonly changeKind: string
    /** owner, nivo or system. */
    readonly authorKind: string
    /** The member who made it, or null. */
    readonly authorId: string | null
    /** The reason or summary. */
    readonly note: string
    /** The template provenance, or null. */
    readonly templateId: string | null
    /** The template version of the provenance, or null. */
    readonly templateVersion: number | null
    /** The version a rollback copied, or null. */
    readonly fromNumber: number | null
    /** When it was published, ISO. */
    readonly publishedAt: string
    /** How many steps it has. */
    readonly stepCount: number
    /** How many steps differ from the version before; null for the first. */
    readonly changedSteps: number | null
    /** Whether it is the version that runs. */
    readonly active: boolean
}

/** One changed setting as the transport sends it: the values as JSON text, null when absent. */
export interface ParamChangeWire {
    /** The setting. */
    readonly name: string
    /** Its value before, or null. */
    readonly beforeJson: string | null
    /** Its value after, or null. */
    readonly afterJson: string | null
}

/** One differing step as the transport sends it. */
export interface StepDiffWire {
    /** The node key. */
    readonly key: string
    /** added, removed or changed. */
    readonly change: string
    /** The SDK step it runs. */
    readonly step: string
    /** The parts that changed. */
    readonly parts: ReadonlyArray<string>
    /** The settings that changed. */
    readonly params: ReadonlyArray<ParamChangeWire>
}

/** A diff as the transport sends it, with both graphs as JSON text for the drawer to draw. */
export interface WorkflowDiffWire {
    /** The steps that differ. */
    readonly steps: ReadonlyArray<StepDiffWire>
    /** Whether what wakes the graph changed. */
    readonly triggerChanged: boolean
    /** The tools gained. */
    readonly toolsAdded: ReadonlyArray<string>
    /** The tools lost. */
    readonly toolsRemoved: ReadonlyArray<string>
    /** The effects gained. */
    readonly effectsAdded: ReadonlyArray<string>
    /** The effects lost. */
    readonly effectsRemoved: ReadonlyArray<string>
    /** The operations on connected accounts the nodes ask for that they did not. */
    readonly nodeRightsAdded: ReadonlyArray<NodeRightWire>
    /** The operations on connected accounts the nodes no longer ask for. */
    readonly nodeRightsRemoved: ReadonlyArray<NodeRightWire>
    /** The operations the nodes asked to call after a person's yes and now ask to call by themselves. */
    readonly nodeRightsLoosened: ReadonlyArray<NodeRightWire>
    /** The graph before, or null for a first version. */
    readonly beforeJson: string | null
    /** The graph after. */
    readonly afterJson: string
}

/** One operation a node asks for, as a diff row shows it: the entry, and the declared titles of its step and its operation. */
export interface NodeRightWire extends NodeRightAsk {
    /** The title of the step the node runs, as its installed node declares it; null for a step no installed node is. */
    readonly stepTitle: OptionalStepTitle
    /** The title of the operation, as its plugin (a tool) or its provider's ability (a work action) declares it; null when none does. */
    readonly operationTitle: OptionalOperationTitle
}

/** The title of a step by its id, as its installed node declares it. */
export type StepTitleOf = (step: string) => OptionalStepTitle

/** No step has a title: what a caller with no titles of the installed nodes at hand passes. */
const UNTITLED: StepTitleOf = () => null

/** The entries of one side of a diff with their titles; the step of each node is read in the graph that holds the node. */
const titledOf = (
    asks: ReadonlyArray<NodeRightAsk> | undefined,
    graph: GraphSpec | null,
    stepTitleOf: StepTitleOf,
): ReadonlyArray<NodeRightWire> =>
    (asks ?? []).map((ask) => {
        const step = graph?.nodes.find((node) => node.key === ask.nodeKey)?.step
        return {
            ...ask,
            stepTitle: step === undefined ? null : stepTitleOf(step),
            operationTitle: operationTitleOf(ask),
        }
    })

/** A workflow with its graph and history as the transport sends it. */
export interface WorkflowDetailWire {
    /** The workflow. */
    readonly workflow: WorkflowWire
    /** The graph of the version that runs, as JSON text. */
    readonly graphJson: string
    /** The history, newest first. */
    readonly versions: ReadonlyArray<WorkflowVersionWire>
    /** How the graph differs from its template version, or null for one made from scratch. */
    readonly templateDiff: WorkflowDiffWire | null
}

/** What accepting a newer template version would write, as the transport sends it. */
export interface TemplatePreviewWire {
    /** The template version offered. */
    readonly templateVersion: number
    /** What each newer version changed, oldest first. */
    readonly changes: ReadonlyArray<TemplateChangeLines>
    /** The steps both sides changed; the owner's side is kept. */
    readonly conflicts: ReadonlyArray<string>
    /** How the new version would differ from the workflow now. */
    readonly diff: WorkflowDiffWire
}

/** A template version as the transport sends it. */
export interface TemplateVersionWire {
    /** The version number. */
    readonly version: number
    /** When it was published, ISO. */
    readonly publishedAt: string
    /** What changed, one line each. */
    readonly changes: ReadonlyArray<string>
    /** How many steps its graph has. */
    readonly stepCount: number
}

/** A connection a template needs, as the transport sends it. */
export interface TemplateConnectionWire {
    /** The connection kind. */
    readonly kind: string
    /** Its name. */
    readonly label: string
    /** What the graph uses it for. */
    readonly why: string
}

/** A template as the transport sends it, with the graph of its newest version as JSON text. */
export interface TemplateWire {
    /** The template. */
    readonly id: string
    /** The module whose agent runs it. */
    readonly moduleKey: string
    /** Whether it is the template of an agent's main workflow. */
    readonly primary: boolean
    /** The name. */
    readonly name: string
    /** What it does. */
    readonly summary: string
    /** The newest version. */
    readonly latestVersion: number
    /** How many shops run a workflow made from it. */
    readonly shops: number
    /** The connections it needs. */
    readonly requires: ReadonlyArray<TemplateConnectionWire>
    /** Every version, oldest first. */
    readonly versions: ReadonlyArray<TemplateVersionWire>
    /** The graph of the newest version, as JSON text. */
    readonly graphJson: string
}

const jsonOrNull = (value: JsonValue | null): string | null => (value === null ? null : JSON.stringify(value))

/** A workflow view as the wire carries it: the template link flattened. */
export const workflowWireOf = (view: WorkflowView): WorkflowWire => ({
    id: view.id,
    key: view.key,
    name: view.name,
    status: view.status,
    primary: view.primary,
    activeNumber: view.activeNumber,
    latestNumber: view.latestNumber,
    templateId: view.template?.templateId ?? null,
    templateVersion: view.template?.templateVersion ?? null,
    templateName: view.templateName,
    templateLatest: view.templateLatest,
    templateChangedSteps: view.templateChangedSteps,
    stepCount: view.stepCount,
    updatedAt: view.updatedAt,
})

/** A version view as the wire carries it. */
export const workflowVersionWireOf = (view: WorkflowVersionView): WorkflowVersionWire => ({
    id: view.id,
    number: view.number,
    changeKind: view.changeKind,
    authorKind: view.authorKind,
    authorId: view.authorId,
    note: view.note,
    templateId: view.template?.templateId ?? null,
    templateVersion: view.template?.templateVersion ?? null,
    fromNumber: view.fromNumber,
    publishedAt: view.publishedAt,
    stepCount: view.stepCount,
    changedSteps: view.changedSteps,
    active: view.active,
})

/**
 * A diff as the wire carries it, with the two graphs it compares. Each operation the nodes gained, lost or loosened carries the
 * declared title of its step (`stepTitleOf`) and of its operation, so a row never shows a node key or a tool id alone.
 */
export const workflowDiffWireOf = (read: SnapshotDiff, stepTitleOf: StepTitleOf = UNTITLED): WorkflowDiffWire => ({
    steps: read.diff.steps.map((step) => ({
        key: step.key,
        change: step.change,
        step: step.step,
        parts: step.parts,
        params: step.params.map((param) => ({
            name: param.name,
            beforeJson: jsonOrNull(param.before),
            afterJson: jsonOrNull(param.after),
        })),
    })),
    triggerChanged: read.diff.triggerChanged,
    ...read.diff.grant,
    nodeRightsAdded: titledOf(read.diff.nodeRights?.added, read.after, stepTitleOf),
    nodeRightsRemoved: titledOf(read.diff.nodeRights?.removed, read.before, stepTitleOf),
    nodeRightsLoosened: titledOf(read.diff.nodeRights?.loosened, read.after, stepTitleOf),
    beforeJson: read.before === null ? null : JSON.stringify(read.before),
    afterJson: JSON.stringify(read.after),
})

/** A workflow detail as the wire carries it; the template diff compares against the template version the workflow came from. */
export const workflowDetailWireOf = (
    detail: WorkflowDetail,
    stepTitleOf: StepTitleOf = UNTITLED,
): WorkflowDetailWire => ({
    workflow: workflowWireOf(detail.workflow),
    graphJson: JSON.stringify(detail.graph),
    versions: detail.versions.map((item) => workflowVersionWireOf(item)),
    templateDiff:
        detail.templateDiff === null
            ? null
            : workflowDiffWireOf(
                  { before: linkedGraphOf(detail.workflow.template), after: detail.graph, diff: detail.templateDiff },
                  stepTitleOf,
              ),
})

/** A template preview as the wire carries it: the diff from the workflow now to the merged graph. */
export const templatePreviewWireOf = (
    preview: TemplatePreview,
    stepTitleOf: StepTitleOf = UNTITLED,
): TemplatePreviewWire => ({
    templateVersion: preview.templateVersion,
    changes: preview.changes,
    conflicts: preview.conflicts,
    diff: workflowDiffWireOf({ before: preview.current, after: preview.merged, diff: preview.diff }, stepTitleOf),
})

/** A template in the reader's language, with its versions oldest first and the graph of its newest. */
export const templateWireOf = (template: WorkflowTemplate, locale: Locale): TemplateWire => ({
    id: template.id,
    moduleKey: template.moduleKey,
    primary: template.primary,
    name: template.name[locale],
    summary: template.summary[locale],
    latestVersion: latestTemplateVersion(template).version,
    shops: template.shops,
    requires: template.requires.map((entry) => ({
        kind: entry.kind,
        label: entry.label[locale],
        why: entry.why[locale],
    })),
    versions: template.versions.map((version) => ({
        version: version.version,
        publishedAt: version.publishedAt,
        changes: version.changes.map((line) => line[locale]),
        stepCount: version.graph.nodes.length,
    })),
    graphJson: JSON.stringify(latestTemplateVersion(template).graph),
})
