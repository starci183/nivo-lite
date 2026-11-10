import type { GraphSpec, WorkflowCallPin } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { WorkflowTemplate } from "@nivo-lite/blocks-core/modules"
import type { GraphVersionView } from "./agent-graphs.contracts"

/** Where a workflow stands: `active` takes wakes, `draft` is kept but never runs, `paused` was active and is stopped. */
export type WorkflowStatus = "active" | "draft" | "paused"

/** How a workflow version came to be. */
export type WorkflowChangeKind =
    "template" | "blank" | "adopt" | "copy" | "edit" | "proposal" | "accept_template" | "rollback"

/** Who made a workflow version: the owner (a member), NIVO (a proposal it raised) or the system (a seed, a copy). */
export type WorkflowAuthorKind = "owner" | "nivo" | "system"

/** Where a template link points: the template and the version a workflow copied or last accepted. Provenance only. */
export interface TemplateLink {
    /** The template id. */
    readonly templateId: string
    /** The template version. */
    readonly templateVersion: number
}

/** A workflow record as the engine returns it. */
export interface WorkflowRecord {
    /** The record id, which is the workflow id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The record version: the fence of every write. */
    readonly fence: string
    /** The agent. */
    readonly agentId: string
    /** The stable key within the agent. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** Where it stands. */
    readonly status: WorkflowStatus
    /** Whether every wake of the agent goes to it unless a narrower active workflow takes it. */
    readonly primary: boolean
    /** The place in the agent's list. */
    readonly position: number
    /** The version that runs, or null before the first. */
    readonly activeVersionId: string | null
    /** The newest version number; 0 before the first. */
    readonly latestNumber: number
    /** The template provenance, or null for a workflow made from scratch. */
    readonly template: TemplateLink | null
    /** The member who made it, or null for one the system made. */
    readonly createdBy: string | null
    /** When it was made. */
    readonly createdAt: Date
    /** When it last changed. */
    readonly updatedAt: Date
}

/** A workflow version record as the engine returns it: an immutable full snapshot. */
export interface WorkflowVersionRecord {
    /** The record id, which is the version id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The workflow. */
    readonly workflowId: string
    /** The agent. */
    readonly agentId: string
    /** The number within the workflow, from 1. */
    readonly number: number
    /** The full graph snapshot, as stored. */
    readonly document: Readonly<Record<string, JsonValue>>
    /** The hash of the snapshot. */
    readonly documentHash: string
    /** How it came to be. */
    readonly changeKind: WorkflowChangeKind
    /** Who made it. */
    readonly authorKind: WorkflowAuthorKind
    /** The member who made it, or null. */
    readonly authorId: string | null
    /** The reason or summary. */
    readonly note: string
    /** The template provenance the version carries, or null. */
    readonly template: TemplateLink | null
    /** The version a rollback copied, or null. */
    readonly fromNumber: number | null
    /** The agent graph version a primary workflow version published or adopted, or null. */
    readonly graphVersionId: string | null
    /** When it was published. */
    readonly publishedAt: Date
}

/** The pin of one run to the workflow version it executes. */
export interface RunWorkflowPin {
    /** The run. */
    readonly runId: string
    /** The workflow. */
    readonly workflowId: string
    /** The workflow version id. */
    readonly workflowVersionId: string
    /** The workflow version number. */
    readonly workflowVersion: number
}

/** How a step differs between two graphs. */
export type StepChange = "added" | "removed" | "changed"

/** A part of a node a change can touch. */
export type StepPart = "kind" | "step" | "params" | "input" | "next" | "routes" | "blocking" | "group" | "wait"

/** One setting of a step that changed, with its value before and after (null when absent). */
export interface ParamChange {
    /** The setting. */
    readonly name: string
    /** Before, or null. */
    readonly before: JsonValue | null
    /** After, or null. */
    readonly after: JsonValue | null
}

/** One step that differs between two graphs. */
export interface StepDiff {
    /** The node key. */
    readonly key: string
    /** How it differs. */
    readonly change: StepChange
    /** The SDK step it runs (after, or before for a removed one). */
    readonly step: string
    /** The parts that changed; empty for an added or removed step. */
    readonly parts: ReadonlyArray<StepPart>
    /** The settings that changed. */
    readonly params: ReadonlyArray<ParamChange>
}

/** What the grant gained and lost. */
export interface GrantDiff {
    /** The rights gained, as `kind:access.field`. */
    readonly rightsAdded: ReadonlyArray<string>
    /** The rights lost. */
    readonly rightsRemoved: ReadonlyArray<string>
    /** The tools gained. */
    readonly toolsAdded: ReadonlyArray<string>
    /** The tools lost. */
    readonly toolsRemoved: ReadonlyArray<string>
    /** The effects gained. */
    readonly effectsAdded: ReadonlyArray<string>
    /** The effects lost. */
    readonly effectsRemoved: ReadonlyArray<string>
}

/** How one graph differs from another, step by step. */
export interface WorkflowDiff {
    /** The steps that differ, in the order of the graph after, then the removed ones. */
    readonly steps: ReadonlyArray<StepDiff>
    /** Whether what wakes the graph changed. */
    readonly triggerChanged: boolean
    /** What the grant gained and lost. */
    readonly grant: GrantDiff
}

/** A step both the owner and the template changed differently since the version the workflow came from. */
export interface MergeConflict {
    /** The node key, or `trigger`. */
    readonly key: string
    /** What the merge kept: the owner's side always. */
    readonly kept: "ours"
}

/** The merge of a newer template version into a workflow. */
export interface TemplateMerge {
    /** The merged graph, before its grant is trimmed. */
    readonly graph: GraphSpec
    /** The steps where both sides changed; the owner's side was kept. */
    readonly conflicts: ReadonlyArray<MergeConflict>
}

/** A workflow as the list reads it. */
export interface WorkflowView {
    /** The workflow id. */
    readonly id: string
    /** The agent. */
    readonly agentId: string
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** Where it stands. */
    readonly status: WorkflowStatus
    /** Whether it is the agent's main workflow. */
    readonly primary: boolean
    /** The number of the version that runs, or null. */
    readonly activeNumber: number | null
    /** The newest version number. */
    readonly latestNumber: number
    /** The template provenance, or null for one made from scratch. */
    readonly template: TemplateLink | null
    /** The template's name in the reader's language, or null. */
    readonly templateName: string | null
    /** The newest version of the template, or null. */
    readonly templateLatest: number | null
    /** How many steps the version that runs differs from the template version it came from, or null. */
    readonly templateChangedSteps: number | null
    /** How many steps the version that runs has. */
    readonly stepCount: number
    /** When it last changed, ISO. */
    readonly updatedAt: string
}

/** A version as the history reads it. */
export interface WorkflowVersionView {
    /** The version id. */
    readonly id: string
    /** The number. */
    readonly number: number
    /** How it came to be. */
    readonly changeKind: WorkflowChangeKind
    /** Who made it. */
    readonly authorKind: WorkflowAuthorKind
    /** The member who made it, or null. */
    readonly authorId: string | null
    /** The reason or summary. */
    readonly note: string
    /** The template provenance it carries, or null. */
    readonly template: TemplateLink | null
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

/** One workflow with its graph, its history and how it differs from its template. */
export interface WorkflowDetail {
    /** The workflow. */
    readonly workflow: WorkflowView
    /** The graph of the version that runs (the newest when none runs). */
    readonly graph: GraphSpec
    /** The history, newest first. */
    readonly versions: ReadonlyArray<WorkflowVersionView>
    /** How the graph differs from the template version it came from, or null for one made from scratch. */
    readonly templateDiff: WorkflowDiff | null
}

/** The workflow a wake goes to: the snapshot it runs and how the run pins it. */
export interface WorkflowRoute {
    /** The agent. */
    readonly agentId: string
    /** The workflow. */
    readonly workflowId: string
    /** The id the run's steps read their graph by: the agent graph version for a primary, else the workflow version. */
    readonly versionId: string
    /** The workflow version id. */
    readonly workflowVersionId: string
    /** The workflow version number. */
    readonly workflowVersion: number
    /** The graph the run executes. */
    readonly flow: GraphSpec
    /** The workflow's stable key, which namespaces its lead memory; absent for a route written before it. */
    readonly workflowKey?: string | undefined
}

/** A workflow as the route reads it: where it stands and what wakes its graph. */
/** One end hand-off of a workflow on the agent Graph page: the outcome it follows and the workflow it calls. */
export interface WorkflowGraphCall {
    /** The hand-off step. */
    readonly nodeKey: string
    /** The outcome key it follows, or null when it follows none. */
    readonly outcome: string | null
    /** The module of the agent it calls. */
    readonly agent: string
    /** That agent's words. */
    readonly agentLabel: string
    /** The key of the workflow it calls. */
    readonly workflow: string
    /** That workflow's name, or null when the workspace has no such workflow. */
    readonly workflowName: string | null
    /** `latest`, or the pinned number as text. */
    readonly version: string
    /** True when the target is run by another agent (or not found). */
    readonly crossAgent: boolean
}

/** One workflow of an agent as its Graph page draws it. */
export interface WorkflowGraphEntry {
    readonly id: string
    readonly key: string
    readonly name: string
    readonly status: WorkflowStatus
    readonly primary: boolean
    /** The number of the version that runs, or null. */
    readonly activeNumber: number | null
    /** Who may call it. */
    readonly entry: "any" | "agent"
    readonly entryLabel: string
    /** Its input contract. */
    readonly inputs: ReadonlyArray<{ readonly name: string; readonly type: string; readonly required: boolean }>
    /** Its inputs: where each is woken from. */
    readonly triggers: ReadonlyArray<{
        readonly key: string
        readonly sourceKind: string
        readonly sourceLabel: string
        readonly connectionId: string | null
    }>
    /** Its named business ends. */
    readonly outcomes: ReadonlyArray<{
        readonly key: string
        readonly label: string
        readonly outputs: ReadonlyArray<{ readonly name: string; readonly type: string }>
    }>
    /** Its end hand-offs. */
    readonly calls: ReadonlyArray<WorkflowGraphCall>
}

/** The agent Graph page: every workflow of one agent. */
export interface AgentWorkflowGraph {
    readonly agentId: string
    readonly workflows: ReadonlyArray<WorkflowGraphEntry>
}

/** What routing reads of a wake: where it came from, its trigger scope, and the pin of an end hand-off (null for any other wake). */
export interface RouteWake {
    /** The tag source it arrived as. */
    readonly source: string
    /** The trigger scope the nodes would read, which the triggers' conditions are judged on. */
    readonly scope: Readonly<Record<string, unknown>>
    /** The workflow and version an end hand-off named. */
    readonly pin: WorkflowCallPin | null
}

export interface RoutableWorkflow {
    /** The workflow id. */
    readonly id: string
    /** Where it stands. */
    readonly status: WorkflowStatus
    /** Whether it is the main workflow. */
    readonly primary: boolean
    /** The place in the list. */
    readonly position: number
    /** The sources its graph wakes on. */
    readonly sources: ReadonlyArray<string>
    /** The stable key within the agent, which namespaces the workflow's lead memory. */
    readonly key?: string | undefined
}

/** Who makes a change: the owner (a member), NIVO (a proposal it raised) or the system. */
export interface WorkflowAuthor {
    /** The kind of author. */
    readonly kind: WorkflowAuthorKind
    /** The member, or null for NIVO and the system. */
    readonly memberId: string | null
}

/** A seat that may change workflows: the member and the role. */
export interface WorkflowEditor extends WorkflowAuthor {
    /** The role: only an owner may widen the agent. */
    readonly role: "owner" | "manager"
}

/** The fence of a change: the newest version number the caller read, or null to take whatever is newest. */
export type ExpectedLatest = number | null

/** What a version diff compares the version with. */
export type DiffAgainst =
    | { readonly kind: "previous" }
    | { readonly kind: "version"; readonly number: number }
    | { readonly kind: "template"; readonly version: number | null }

/** A diff between two snapshots, with what each side is. */
export interface SnapshotDiff {
    /** The graph before, or null when the version is the first. */
    readonly before: GraphSpec | null
    /** The graph after. */
    readonly after: GraphSpec
    /** How they differ. */
    readonly diff: WorkflowDiff
}

/** What one template version says it changed. */
export interface TemplateChangeLines {
    /** The template version. */
    readonly version: number
    /** One line per change, in the reader's language. */
    readonly lines: ReadonlyArray<string>
}

/** What accepting a newer template version would do, for the owner to review first. */
export interface TemplatePreview {
    /** The template version offered. */
    readonly templateVersion: number
    /** What the template says changed in each version since the workflow's, oldest first. */
    readonly changes: ReadonlyArray<TemplateChangeLines>
    /** The workflow's graph now. */
    readonly current: GraphSpec
    /** The graph the new version would hold. */
    readonly merged: GraphSpec
    /** How the new version would differ from the workflow now. */
    readonly diff: WorkflowDiff
    /** The steps both sides changed; the owner's side is kept. */
    readonly conflicts: ReadonlyArray<string>
}

/** An agent graph version with the flow it froze, as an adoption copies it into the primary workflow. */
export interface AdoptedVersion {
    /** The agent graph version. */
    readonly view: GraphVersionView
    /** Its flow. */
    readonly flow: GraphSpec
}

/** What writing a workflow version takes. */
export interface VersionWrite {
    /** The workflow as the caller read it: its newest number and record version fence the write. */
    readonly workflow: WorkflowRecord
    /** The full snapshot. */
    readonly graph: GraphSpec
    /** How it came to be. */
    readonly kind: WorkflowChangeKind
    /** Who made it. */
    readonly author: WorkflowAuthor
    /** The reason or summary. */
    readonly note: string
    /** The template provenance the version carries and the workflow moves to. */
    readonly template: TemplateLink | null
    /** The version a rollback or a copy came from. */
    readonly fromNumber: number | null
    /** The agent graph version it adopts; null publishes one for a primary workflow. */
    readonly graphVersionId: string | null
    /** The newest number the caller read. */
    readonly expected: ExpectedLatest
    /** When it was published, for an adopted version; now when absent. */
    readonly publishedAt?: string | undefined
}

/** What making a workflow takes. */
export interface WorkflowCreate {
    /** The agent. */
    readonly agentId: string
    /** The key, unique within the agent. */
    readonly key: string
    /** The name. */
    readonly name: string
    /** Where it starts. */
    readonly status: WorkflowStatus
    /** Whether it is the agent's main workflow. */
    readonly primary: boolean
    /** The template provenance, or null. */
    readonly template: TemplateLink | null
    /** The member who made it, or null. */
    readonly createdBy: string | null
}

/** A version just written, with the workflow after it. */
export interface WrittenVersion {
    /** The workflow after the write. */
    readonly workflow: WorkflowRecord
    /** The version. */
    readonly version: WorkflowVersionRecord
}

/** The merge of a newer template version into a workflow, with the template and the link it came from. */
export interface MergeOutcome {
    /** The merge. */
    readonly merged: TemplateMerge
    /** The template. */
    readonly template: WorkflowTemplate
    /** The provenance the workflow had. */
    readonly link: TemplateLink
}

/** The workflow and version one run executes, with the workflow's name. */
export interface RunPinView {
    /** The run. */
    readonly runId: string
    /** The workflow. */
    readonly workflowId: string
    /** Its name. */
    readonly workflowName: string
    /** The workflow version number the run executes. */
    readonly version: number
}

/** A workflow version read as an agent graph version, for the steps of a run pinned to it. */
export interface WorkflowVersionDocument {
    /** The agent. */
    readonly agentId: string
    /** The workflow version number. */
    readonly number: number
    /** The snapshot as an agent graph document: no rule-derived nodes, the flow only. */
    readonly document: Readonly<Record<string, unknown>>
}

/** What a template blank workflow is made of: its name and the module whose agent runs it. */
export interface BlankWorkflow {
    /** The name. */
    readonly name: string
    /** The module. */
    readonly moduleKey: string
}

/** Which template version a workflow copies: the newest when `version` is null. */
export interface TemplatePick {
    /** The template. */
    readonly templateId: string
    /** The version, or null for the newest. */
    readonly version: number | null
}

/** The installation agents a copy reads from and writes to. */
export interface WorkflowCopy {
    /** The installation copied from. */
    readonly fromInstallationId: string
    /** The installation copied to. */
    readonly toInstallationId: string
}

/** A workflow id, or null when there is none. */
export type OptionalWorkflowId = string | null

/** The workflow a wake goes to, or null when the agent's own graph answers it. */
export type OptionalWorkflowRoute = WorkflowRoute | null

/** A workflow record, or null when there is none. */
export type OptionalWorkflowRecord = WorkflowRecord | null

/** A workflow version record, or null when there is none. */
export type OptionalWorkflowVersionRecord = WorkflowVersionRecord | null

/** The declared fields a store write sets, by field name. */
export type RecordValues = MutationValues
