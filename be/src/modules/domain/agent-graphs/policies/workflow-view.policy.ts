import { createHash } from "node:crypto"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion, templateVersionOf, workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import type { WorkflowTemplate } from "@nivo-lite/blocks-core/modules"
import type { Locale } from "@modules/platform/i18n"
import type { GraphChangeKind, GraphVersionView } from "../agent-graphs.contracts"
import type {
    DiffAgainst,
    TemplateLink,
    WorkflowAuthor,
    WorkflowChangeKind,
    WorkflowRecord,
    WorkflowStatus,
    WorkflowVersionRecord,
    WorkflowVersionView,
    WorkflowView,
} from "../agent-workflows.contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { changedStepCount } from "./workflow-diff.policy"
import { closestTemplateVersion } from "./workflow-version.policy"

/** The workflow, or the version of it, is not there. */
export const workflowNotFound = (): AgentGraphsError =>
    new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowNotFound })

/** Someone published a version after the caller read the workflow. */
export const workflowConflict = (): AgentGraphsError =>
    new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowConflict })

/** The change is refused, for the reason named. */
export const workflowRefused = (reason: string): AgentGraphsError =>
    new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowRefused, params: { reason } })

/** The hash of a snapshot; the same graph always has the same hash. */
export const snapshotHashOf = (graph: GraphSpec): string =>
    createHash("sha256").update(JSON.stringify(graph)).digest("hex")

/** A stored snapshot read back as a graph; one that does not parse is a record the product cannot read. */
export const snapshotOf = (version: WorkflowVersionRecord): GraphSpec => {
    const parsed = graphSpecSchema.safeParse(version.document)
    if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
    return parsed.data
}

/** The template of this id; refused when there is none. */
export const templateRequired = (id: string): WorkflowTemplate => {
    const template = workflowTemplateOf(id)
    if (template === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.TemplateNotFound })
    return template
}

/** The graph of one version of a template; refused when the template has no such version. */
export const templateGraphOf = (template: WorkflowTemplate, version: number): GraphSpec => {
    const found = templateVersionOf(template, version)
    if (found === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.TemplateNotFound })
    return found.graph
}

/** The graph of the template version a link names, or null when the template or the version is gone. */
export const linkedGraphOf = (link: TemplateLink | null): GraphSpec | null => {
    const template = link === null ? null : workflowTemplateOf(link.templateId)
    if (link === null || template === null) return null
    return templateVersionOf(template, link.templateVersion)?.graph ?? null
}

/** The template version a graph is closest to, as provenance; null without a template. */
export const closestLinkOf = (template: WorkflowTemplate | null, graph: GraphSpec): TemplateLink | null => {
    if (template === null) return null
    const version = closestTemplateVersion(template, graph)
    return version === null ? null : { templateId: template.id, templateVersion: version }
}

/** The workflow change kind of an agent graph version the primary workflow adopts; the first one is the adoption itself. */
export const adoptedKindOf = (kind: GraphChangeKind, first: boolean): WorkflowChangeKind => {
    if (first) return "adopt"
    if (kind === "learned" || kind === "conflict") return "proposal"
    if (kind === "rollback" || kind === "template" || kind === "edit") return kind
    return kind === "chat" ? "edit" : "adopt"
}

/** Who made an agent graph version the primary workflow adopts: NIVO for a learned or conflict change, else its publisher or the system. */
export const adoptedAuthorOf = (version: GraphVersionView): WorkflowAuthor => {
    if (version.changeKind === "learned" || version.changeKind === "conflict") {
        return { kind: "nivo", memberId: version.publishedBy }
    }
    return version.publishedBy === null
        ? { kind: "system", memberId: null }
        : { kind: "owner", memberId: version.publishedBy }
}

/** The agent graph change kind a primary workflow version publishes as. */
export const graphKindOf = (kind: WorkflowChangeKind): GraphChangeKind => {
    if (kind === "rollback" || kind === "edit") return kind
    if (kind === "proposal") return "learned"
    if (kind === "template" || kind === "accept_template") return "template"
    return "spec"
}

/** The language a request names: English when it says en, else Vietnamese. */
export const workflowLocaleOf = (text: string | null | undefined): Locale => (text === "en" ? "en" : "vi")

/** The status a request names; anything but active or paused is a draft. */
export const workflowStatusOf = (text: string): WorkflowStatus => {
    if (text === "active" || text === "paused") return text
    return "draft"
}

/** What a diff request compares with; `version` needs the number of the version. */
export const diffAgainstOf = (against: string, number: number | null): DiffAgainst => {
    if (against === "template") return { kind: "template", version: number }
    if (against !== "version") return { kind: "previous" }
    if (number === null) throw workflowRefused("against")
    return { kind: "version", number }
}

/** A workflow as the list reads it, with what it runs and how far it is from its template version. */
export const workflowViewOf = (
    workflow: WorkflowRecord,
    running: WorkflowVersionRecord | null,
    locale: Locale,
): WorkflowView => {
    const template = workflow.template === null ? null : workflowTemplateOf(workflow.template.templateId)
    const graph = running === null ? null : snapshotOf(running)
    const base = linkedGraphOf(workflow.template)
    return {
        id: workflow.id,
        agentId: workflow.agentId,
        key: workflow.key,
        name: workflow.name,
        status: workflow.status,
        primary: workflow.primary,
        activeNumber: running?.number ?? null,
        latestNumber: workflow.latestNumber,
        template: workflow.template,
        templateName: template === null ? null : template.name[locale],
        templateLatest: template === null ? null : latestTemplateVersion(template).version,
        templateChangedSteps: base === null || graph === null ? null : changedStepCount(base, graph),
        stepCount: graph?.nodes.length ?? 0,
        updatedAt: workflow.updatedAt.toISOString(),
    }
}

/** A version as the history reads it, with how many steps differ from `previous`. */
export const workflowVersionViewOf = (
    version: WorkflowVersionRecord,
    previous: GraphSpec | null,
    active: boolean,
): WorkflowVersionView => {
    const graph = snapshotOf(version)
    return {
        id: version.id,
        number: version.number,
        changeKind: version.changeKind,
        authorKind: version.authorKind,
        authorId: version.authorId,
        note: version.note,
        template: version.template,
        fromNumber: version.fromNumber,
        publishedAt: version.publishedAt.toISOString(),
        stepCount: graph.nodes.length,
        changedSteps: previous === null ? null : changedStepCount(previous, graph),
        active,
    }
}

/** The history of a workflow, newest first, each version compared with the one before it. */
export const workflowHistoryOf = (
    versions: ReadonlyArray<WorkflowVersionRecord>,
    activeVersionId: string | null,
): ReadonlyArray<WorkflowVersionView> => {
    const byNumber = new Map(versions.map((version) => [version.number, version]))
    return versions.map((version) => {
        const previous = byNumber.get(version.number - 1)
        return workflowVersionViewOf(
            version,
            previous === undefined ? null : snapshotOf(previous),
            version.id === activeVersionId,
        )
    })
}

/** The snapshot a diff compares a version with: the one before it (null for the first), another version, or a template version. */
export const againstGraphOf = (
    workflow: WorkflowRecord,
    versions: ReadonlyArray<WorkflowVersionRecord>,
    target: WorkflowVersionRecord,
    against: DiffAgainst,
): GraphSpec | null => {
    if (against.kind === "template") {
        const link = target.template ?? workflow.template
        if (link === null) throw workflowRefused("no-template")
        return templateGraphOf(templateRequired(link.templateId), against.version ?? link.templateVersion)
    }
    const wanted = against.kind === "previous" ? target.number - 1 : against.number
    const found = versions.find((version) => version.number === wanted)
    if (found !== undefined) return snapshotOf(found)
    if (against.kind === "previous") return null
    throw workflowNotFound()
}
