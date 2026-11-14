import type { BadgeTone } from "@starci/grammar/common"
import { toolLabelOf, triggerViewsOf } from "@/modules/plugin-registry"
import { specOf } from "@/modules/workflowSteps"
import { humanLabelOf } from "@/modules/agentRuns"
import { toolWordOf } from "@/modules/toolNames"
import { flowOfGraph, graphOfJson, stepWordsOf, type StepWordsOf } from "./agentWorkflows.flow"
import type {
    WorkflowContext,
    WorkflowDetailWire,
    WorkflowDiffWire,
    WorkflowTemplateWire,
    WorkflowVersionWire,
    WorkflowWire,
} from "./agentWorkflows.types"
import type {
    WorkflowDetailView,
    WorkflowDiffGrantView,
    WorkflowDiffStepView,
    WorkflowDiffView,
    WorkflowHeadView,
    WorkflowMark,
    WorkflowNoticeView,
    WorkflowRowView,
    WorkflowStatus,
    WorkflowTemplateDetailView,
    WorkflowTemplateRowView,
    WorkflowVersionRowView,
} from "@/modules/types"

/** The tone each status paints. */
const STATUS_TONES: Readonly<Record<WorkflowStatus, BadgeTone>> = {
    active: "success",
    draft: "neutral",
    paused: "warning",
}

/** The status a wire word names; an unknown word reads as a draft. */
export const statusOf = (word: string): WorkflowStatus => (word === "active" || word === "paused" ? word : "draft")

/** "from the template Reconcile v2", or the word for a workflow made from scratch. */
const provenanceOf = (workflow: WorkflowWire, context: WorkflowContext): string =>
    workflow.templateId === null || workflow.templateVersion === null
        ? context.t("provenanceNone")
        : context.t("provenance", {
              name: workflow.templateName ?? humanLabelOf(workflow.templateId),
              version: workflow.templateVersion,
          })

/** One workflow as a row of the left pane. */
export const workflowRowOf = (workflow: WorkflowWire, context: WorkflowContext): WorkflowRowView => {
    const status = statusOf(workflow.status)
    return {
        id: workflow.id,
        name: workflow.name,
        statusLabel: context.t(`status_${status}`),
        statusTone: STATUS_TONES[status],
        versionLabel: context.t("version", { number: workflow.activeNumber ?? workflow.latestNumber }),
        provenance: provenanceOf(workflow, context),
    }
}

/** The head card of the open workflow. */
const headOf = (workflow: WorkflowWire, context: WorkflowContext): WorkflowHeadView => {
    const status = statusOf(workflow.status)
    const row = workflowRowOf(workflow, context)
    return {
        ...row,
        status,
        facts: [
            row.versionLabel,
            context.t("steps", { count: workflow.stepCount }),
            context.dateOf(workflow.updatedAt),
        ].join(" · "),
        toggleLabel: status === "active" ? context.t("pause") : context.t("resume"),
        toggleTo: status === "active" ? "paused" : "active",
        canEditGraph: workflow.latestNumber > 0,
    }
}

/** An edit the owner named (a settings change of one step): its words go in the title. */
const isNotedEdit = (version: WorkflowVersionWire): boolean => version.changeKind === "edit" && version.note !== ""

/** The title of a version: "Version 3", with where it came from when it was a sync from the template or a rollback. */
const versionTitleOf = (version: WorkflowVersionWire, context: WorkflowContext): string => {
    if (version.changeKind === "accept_template" && version.templateVersion !== null)
        return context.t("titleSynced", { number: version.number, template: version.templateVersion })
    if (version.changeKind === "rollback" && version.fromNumber !== null)
        return context.t("titleRollback", { number: version.number, from: version.fromNumber })
    if (isNotedEdit(version))
        return context.t("titleNoted", {
            number: version.number,
            note: version.note.charAt(0).toLowerCase() + version.note.slice(1),
        })
    return context.t("version", { number: version.number })
}

/** Why a version was made, under its title: the note, else the words of its kind; empty when the title says it already. */
const versionNoteOf = (version: WorkflowVersionWire, context: WorkflowContext): string => {
    if (isNotedEdit(version) || (version.changeKind === "rollback" && version.fromNumber !== null)) return ""
    const kind = `kind_${version.changeKind}`
    return version.note === "" && context.has(kind) ? context.t(kind) : version.note
}

/** One version as a row of the history: who made it, why, and when. */
const versionRowOf = (version: WorkflowVersionWire, context: WorkflowContext): WorkflowVersionRowView => {
    return {
        number: version.number,
        title: versionTitleOf(version, context),
        description: [
            context.t(`author_${version.authorKind}`),
            versionNoteOf(version, context),
            context.dateOf(version.publishedAt),
        ]
            .filter((part) => part !== "")
            .join(" · "),
        isActive: version.active,
        author: context.t(`author_${version.authorKind}`),
        note: versionNoteOf(version, context),
        date: context.dateOf(version.publishedAt),
    }
}

/**
 * Whether the newer template version can be previewed and accepted: the back end merges from the template version the workflow was
 * made from, and `templateChangedSteps` is null when that version no longer exists in the template (or nothing runs yet).
 */
export const canUpdateFrom = (workflow: WorkflowWire): boolean =>
    workflow.templateVersion !== null && workflow.templateChangedSteps !== null

/** The notice that a newer template version exists; none when the workflow is on the newest or made from scratch. */
export const noticeOf = (
    workflow: WorkflowWire,
    changes: ReadonlyArray<{ readonly version: number; readonly lines: ReadonlyArray<string> }>,
    changedSteps: number | null,
    context: WorkflowContext,
): WorkflowNoticeView | null => {
    const { templateLatest, templateVersion } = workflow
    if (templateLatest === null || templateVersion === null || templateLatest <= templateVersion) return null
    return {
        version: templateLatest,
        title: context.t("noticeTitle", { version: templateLatest }),
        changelog: changes
            .flatMap((change) => change.lines)
            .slice(0, 2)
            .join(" · "),
        diffLine: changedSteps === null ? "" : context.t("noticeDiff", { count: changedSteps }),
        canUpdate: canUpdateFrom(workflow),
    }
}

/** The open workflow as the main pane draws it: the head, the template notice, the map of the version that runs and the history. */
export const workflowDetailOf = (
    wire: WorkflowDetailWire,
    notice: WorkflowNoticeView | null,
    context: WorkflowContext,
): WorkflowDetailView => ({
    head: headOf(wire.workflow, context),
    notice,
    graphTitle: context.t("graphTitle", { number: wire.workflow.activeNumber ?? wire.workflow.latestNumber }),
    flow: flowOfGraph(wire.graphJson, null, new Map(), context),
    versions: wire.versions.map((version) => versionRowOf(version, context)),
})

/** A value of a setting, short enough for a line. */
const shortOf = (json: string | null): string => {
    if (json === null) return "-"
    const text = json.length > 32 ? `${json.slice(0, 31)}…` : json
    return text
}

/** What a changed step says of its change: the parts that changed in words, and the settings with their values before and after. */
const stepChangeOf = (
    step: WorkflowDiffWire["steps"][number],
    words: StepWordsOf | undefined,
    context: WorkflowContext,
): { readonly description: string; readonly change?: { readonly from: string; readonly to: string } } => {
    if (step.change !== "changed") return { description: words?.line ?? "" }
    const description = step.parts
        .map((part) => (context.has(`part_${part}`) ? context.t(`part_${part}`) : part))
        .join(", ")
    const params = step.params.slice(0, 3)
    if (params.length === 0) return { description }
    const nameOf = (name: string): string => words?.params.get(name) ?? name
    return {
        description,
        change: {
            from: params.map((param) => `${nameOf(param.name)}: ${shortOf(param.beforeJson)}`).join(", "),
            to: params.map((param) => `${nameOf(param.name)}: ${shortOf(param.afterJson)}`).join(", "),
        },
    }
}

/** The marks of a diff, by the key of the step. */
const marksOf = (diff: WorkflowDiffWire): ReadonlyMap<string, WorkflowMark> =>
    new Map(
        diff.steps.map((step): [string, WorkflowMark] => [
            step.key,
            step.change === "added" || step.change === "removed" ? step.change : "changed",
        ]),
    )

/**
 * The plain words of a tool or an effect (`nivo.tool.customer.message.send`), from the labels the tool vocabulary ships (one place for
 * the words of a tool, whatever page names it); one no label names says a general phrase, never the id.
 */
const grantWordOf = (kind: "tool" | "effect", id: string, context: WorkflowContext): string =>
    toolWordOf(id, context.locale, toolLabelOf, context.t(kind === "tool" ? "toolOther" : "effectOther"))

/** The node modes, tools and actions gained and lost, one row each in the owner's words, and what wakes the graph when that changed. */
const grantsOf = (
    diff: WorkflowDiffWire,
    context: WorkflowContext,
    stepTitleOf: (nodeKey: string) => string,
): ReadonlyArray<WorkflowDiffGrantView> => {
    const nodeRight = (
        mark: "added" | "removed" | "changed",
        right: WorkflowDiffWire["nodeRightsAdded"][number],
        isLoosened: boolean,
    ): WorkflowDiffGrantView => {
        const values = { step: stepTitleOf(right.nodeKey), operation: right.operation }
        return {
            key: `nodeRight-${mark}-${right.nodeKey}-${right.connectionId}-${right.operation}`,
            title: isLoosened
                ? context.t("nodeRightLoosened", values)
                : context.t("nodeRightLine", { ...values, mode: context.t(right.mode === "auto" ? "nodeRightAuto" : "nodeRightAsk") }),
            kindLabel: context.t("grantKind_nodeRight"),
            mark,
            markLabel: context.t(`mark_${mark}`),
        }
    }
    const nodeRights: ReadonlyArray<WorkflowDiffGrantView> = [
        ...diff.nodeRightsAdded.map((right) => nodeRight("added", right, false)),
        ...diff.nodeRightsRemoved.map((right) => nodeRight("removed", right, false)),
        ...diff.nodeRightsLoosened.map((right) => nodeRight("changed", right, true)),
    ]
    const lists: ReadonlyArray<readonly [string, "added" | "removed", ReadonlyArray<string>]> = [
        ["tool", "added", [...new Set(diff.toolsAdded.map((id) => grantWordOf("tool", id, context)))]],
        ["tool", "removed", [...new Set(diff.toolsRemoved.map((id) => grantWordOf("tool", id, context)))]],
        ["effect", "added", [...new Set(diff.effectsAdded.map((id) => grantWordOf("effect", id, context)))]],
        ["effect", "removed", [...new Set(diff.effectsRemoved.map((id) => grantWordOf("effect", id, context)))]],
    ]
    return [
        ...nodeRights,
        ...lists.flatMap(([kind, mark, words]) =>
            words.map((title) => ({
                key: `${kind}-${mark}-${title}`,
                title,
                kindLabel: context.t(`grantKind_${kind}`),
                mark,
                markLabel: context.t(`mark_${mark}`),
            })),
        ),
    ]
}

/** "+2 steps · -1 steps · 3 changed": the count of each mark of the steps, a mark none has left out. */
const summaryOf = (marks: ReadonlyMap<string, WorkflowMark>, context: WorkflowContext): string => {
    const count = (mark: WorkflowMark): number => [...marks.values()].filter((one) => one === mark).length
    const parts = [
        count("added") === 0 ? "" : context.t("summaryAdded", { count: count("added") }),
        count("removed") === 0 ? "" : context.t("summaryRemoved", { count: count("removed") }),
        count("changed") === 0 ? "" : context.t("summaryChanged", { count: count("changed") }),
    ]
    return parts.filter((part) => part !== "").join(" · ")
}

/**
 * A version against the one before it, as its page draws it: the steps added, removed and changed, the rights, tools and actions gained
 * or lost, and the map with the changed steps painted. A first version has nothing before it: it carries `first` and the plain map.
 */
export const diffViewOf = (diff: WorkflowDiffWire, context: WorkflowContext): WorkflowDiffView => {
    if (diff.beforeJson === null)
        return {
            first: context.t("diffFirstNote"),
            summary: "",
            steps: [],
            grants: [],
            flow: flowOfGraph(diff.afterJson, null, new Map(), context),
        }
    const marks = marksOf(diff)
    const words = stepWordsOf([graphOfJson(diff.afterJson, context), graphOfJson(diff.beforeJson, context)])
    const titleOf = (key: string): string => words.get(key)?.title ?? humanLabelOf(key)
    const triggerRow: ReadonlyArray<WorkflowDiffGrantView> = diff.triggerChanged
        ? [
              {
                  key: "trigger",
                  title: context.t("triggerChanged"),
                  kindLabel: context.t("grantKind_trigger"),
                  mark: "changed",
                  markLabel: context.t("mark_changed"),
              },
          ]
        : []
    return {
        first: "",
        summary: summaryOf(marks, context),
        steps: diff.steps.map((step): WorkflowDiffStepView => {
            const mark = marks.get(step.key) ?? "changed"
            return {
                key: step.key,
                title: titleOf(step.key),
                mark,
                markLabel: context.t(`mark_${mark}`),
                ...stepChangeOf(step, words.get(step.key), context),
            }
        }),
        grants: [...triggerRow, ...grantsOf(diff, context, titleOf)],
        flow: flowOfGraph(diff.afterJson, diff.beforeJson, marks, context),
    }
}

/** What starts a template, in words: the sources of its triggers ("SePay", "Schedule", "Zalo OA or Facebook"); the first thing it needs when it names none. */
const templateSourceOf = (template: WorkflowTemplateWire, context: WorkflowContext): string => {
    const spec = specOf(template.graphJson)
    const labels = spec === null ? [] : triggerViewsOf(spec, context.locale).map((trigger) => trigger.sourceLabel)
    const unique = [...new Set(labels)]
    return unique.length === 0 ? (template.requires[0]?.label ?? "") : unique.join(" · ")
}

/** One template as a row of the market. */
export const templateRowOf = (template: WorkflowTemplateWire, context: WorkflowContext): WorkflowTemplateRowView => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    meta: context.t("templateMeta", { latest: template.latestVersion, shops: template.shops }),
    role: context.has(`roleChip_${template.moduleKey}`)
        ? context.t(`roleChip_${template.moduleKey}`)
        : template.moduleKey,
    source: templateSourceOf(template, context),
    needs:
        template.requires.length === 0
            ? ""
            : context.t("templateNeeds", { list: template.requires.map((item) => item.label).join(", ") }),
    latest: template.latestVersion,
})

/** One template with the map of its newest version and what each version changed, newest first. */
export const templateDetailOf = (
    template: WorkflowTemplateWire,
    context: WorkflowContext,
): WorkflowTemplateDetailView => ({
    ...templateRowOf(template, context),
    flow: flowOfGraph(template.graphJson, null, new Map(), context),
    versions: [...template.versions]
        .sort((left, right) => right.version - left.version)
        .map((version) => ({
            version: version.version,
            title: context.t("templateVersion", {
                version: version.version,
                date: context.dateOf(version.publishedAt),
            }),
            changes: version.changes,
        })),
})
