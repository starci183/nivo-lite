import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { MergeOutcome, WorkflowRecord, WorkflowVersionRecord } from "../agent-workflows.contracts"
import { mergeTemplate } from "./workflow-merge.policy"
import { acceptableTemplateVersion } from "./workflow-version.policy"
import { templateVersionOf } from "@nivo-lite/agent-sdk/template"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { optionalSnapshotOf, templateGraphOf, templateRequired, workflowRefused } from "./workflow-view.policy"

/**
 * The workflow's OWN stored copy of the template version it is linked to: the oldest of its versions written from that very template
 * version (made from it, or an accepted update to it), read back as a graph; null when it holds none that still parses.
 */
export const storedTemplateCopyOf = (
    workflow: WorkflowRecord,
    versions: ReadonlyArray<WorkflowVersionRecord>,
): GraphSpec | null => {
    const link = workflow.template
    if (link === null) return null
    const copy = versions
        .filter(
            (version) =>
                version.template?.templateId === link.templateId && version.template.templateVersion === link.templateVersion,
        )
        .toSorted((left, right) => left.number - right.number)[0]
    return copy === undefined ? null : optionalSnapshotOf(copy)
}

/**
 * The merge of a newer version of a workflow's template into the graph the workflow runs: the template's changes on the steps the
 * owner left alone, the owner's side kept wherever both changed. Refused for a workflow that came from no template and for a
 * template version the workflow may not move to.
 */
export const templateMergeOf = (
    workflow: WorkflowRecord,
    current: GraphSpec,
    templateVersion: number,
    versions: ReadonlyArray<WorkflowVersionRecord>,
): MergeOutcome => {
    const link = workflow.template
    if (link === null) throw workflowRefused("no-template")
    const template = templateRequired(link.templateId)
    if (!acceptableTemplateVersion(link, template.id, templateVersion)) throw workflowRefused("template-version")
    // The merge base is the template version the workflow came from. A template may drop an old version (a package that ships only
    // its newest): the workflow's own stored copy of that version stands in, so an installed copy never needs it to still exist.
    const base = templateVersionOf(template, link.templateVersion)?.graph ?? storedTemplateCopyOf(workflow, versions)
    if (base === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.TemplateNotFound })
    const merged = mergeTemplate(base, current, templateGraphOf(template, templateVersion))
    return { merged, template, link }
}

/** The graph of a workflow made from scratch: a graph of the module with one step that ends the run. */
export const blankGraphOf = (moduleKey: string): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey,
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
})
