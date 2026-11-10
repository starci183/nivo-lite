import type { BadgeTone } from "@starci/grammar/common"
import { triggerViewsOf } from "@nivo-lite/blocks-core/graph"
import { specOf } from "@/modules/workflowSteps"
import { humanLabelOf } from "@/modules/agentRuns"
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

/** The line under a changed step: the parts that changed, then the settings with their values before and after, all in words. */
const stepLineOf = (
    step: WorkflowDiffWire["steps"][number],
    words: StepWordsOf | undefined,
    context: WorkflowContext,
): string => {
    if (step.change !== "changed") return words?.line ?? ""
    return [
        step.parts.map((part) => (context.has(`part_${part}`) ? context.t(`part_${part}`) : part)).join(", "),
        ...step.params
            .slice(0, 3)
            .map(
                (param) =>
                    `${words?.params.get(param.name) ?? param.name}: ${shortOf(param.beforeJson)} → ${shortOf(param.afterJson)}`,
            ),
    ]
        .filter((part) => part !== "")
        .join(" · ")
}

/** The marks of a diff, by the key of the step. */
const marksOf = (diff: WorkflowDiffWire): ReadonlyMap<string, WorkflowMark> =>
    new Map(
        diff.steps.map((step): [string, WorkflowMark] => [
            step.key,
            step.change === "added" || step.change === "removed" ? step.change : "changed",
        ]),
    )

/** The lines beyond the steps: what wakes the graph, and the rights, tools and effects gained and lost. */
const otherLinesOf = (diff: WorkflowDiffWire, context: WorkflowContext): ReadonlyArray<string> => {
    const lists: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
        ["rightsAdded", diff.rightsAdded],
        ["rightsRemoved", diff.rightsRemoved],
        ["toolsAdded", diff.toolsAdded],
        ["toolsRemoved", diff.toolsRemoved],
        ["effectsAdded", diff.effectsAdded],
        ["effectsRemoved", diff.effectsRemoved],
    ]
    return [
        ...(diff.triggerChanged ? [context.t("triggerChanged")] : []),
        ...lists
            .filter(([, items]) => items.length > 0)
            .map(([key, items]) => context.t(`line_${key}`, { list: items.join(", ") })),
    ]
}

/**
 * A diff as the drawer draws it: the steps added, removed and changed, the other changes, the steps where both sides changed and the
 * owner's side stays, and the map with the changed steps painted.
 */
export const diffViewOf = (
    diff: WorkflowDiffWire,
    conflicts: ReadonlyArray<string>,
    context: WorkflowContext,
): WorkflowDiffView => {
    const marks = marksOf(diff)
    const words = stepWordsOf([graphOfJson(diff.afterJson, context), graphOfJson(diff.beforeJson, context)])
    const titleOf = (key: string): string => words.get(key)?.title ?? humanLabelOf(key)
    const steps = diff.steps.map((step): WorkflowDiffStepView => {
        const mark = marks.get(step.key) ?? "changed"
        return {
            key: step.key,
            title: titleOf(step.key),
            mark,
            markLabel: context.t(`mark_${mark}`),
            description: stepLineOf(step, words.get(step.key), context),
        }
    })
    return {
        steps,
        lines: otherLinesOf(diff, context),
        kept: conflicts.length === 0 ? "" : context.t("kept", { steps: conflicts.map((conflict) => titleOf(conflict)).join(", ") }),
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
    role: context.has(`roleChip_${template.moduleKey}`) ? context.t(`roleChip_${template.moduleKey}`) : template.moduleKey,
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
