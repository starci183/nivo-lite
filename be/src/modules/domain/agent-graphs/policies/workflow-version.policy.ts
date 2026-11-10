import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowTemplate } from "@nivo-lite/blocks-core/modules"
import type { TemplateLink, WorkflowStatus } from "../agent-workflows.contracts"
import { changedStepCount } from "./workflow-diff.policy"

/** The Vietnamese letter d with stroke, which has no decomposed form, so dropping the marks leaves it. */
const D_STROKE = String.fromCodePoint(0x111)

/** The most characters of a workflow key. */
const KEY_MAX = 60

/**
 * The number the next version of a workflow takes: one above the newest, so history only grows. `expected` is the newest number the
 * caller read; a different newest means someone published in between, and the caller must read again (null).
 */
export const nextVersionNumber = (latest: number, expected: number | null): number | null =>
    expected !== null && expected !== latest ? null : latest + 1

/**
 * The template version a graph came from when nothing recorded it (the agent's graph that was running before workflows): the version
 * whose graph differs from it in the fewest steps, the newest of those that tie. Null for a template with no versions.
 */
export const closestTemplateVersion = (template: WorkflowTemplate, graph: GraphSpec): number | null =>
    template.versions.reduce<{ readonly version: number; readonly changed: number } | null>((best, version) => {
        const changed = changedStepCount(version.graph, graph)
        return best === null || changed < best.changed || (changed === best.changed && version.version > best.version)
            ? { version: version.version, changed }
            : best
    }, null)?.version ?? null

/** The newest version of a template that a workflow linked to `link` has not taken yet, or null when it is up to date. */
export const newerTemplateVersion = (template: WorkflowTemplate, link: TemplateLink | null): number | null => {
    if (link?.templateId !== template.id) return null
    const newest = Math.max(...template.versions.map((version) => version.version))
    return newest > link.templateVersion ? newest : null
}

/**
 * Whether a template version may be accepted into a workflow: only a version newer than the one the workflow came from, of the template
 * it came from. Accepting never goes back: an older template is reached by rolling the workflow back instead.
 */
export const acceptableTemplateVersion = (link: TemplateLink | null, templateId: string, version: number): boolean =>
    link !== null && link.templateId === templateId && version > link.templateVersion

/** Where a workflow moves its status from: whether it is the primary one and whether it has a version to run. */
export interface StatusFrom {
    /** Whether it is the agent's main workflow. */
    readonly primary: boolean
    /** Whether it has a version to run. */
    readonly hasVersion: boolean
}

/**
 * The status a workflow may move to: a draft or paused workflow may go active only when it has a version to run; any workflow may go
 * to draft or paused. The primary workflow cannot leave `active`: every wake no other workflow takes must still find a graph.
 */
export const statusAllowed = (from: StatusFrom, to: WorkflowStatus): boolean => {
    if (to === "active") return from.hasVersion
    return !from.primary
}

/** A key for a workflow: the template's slug, or the name's letters and digits, kept unique against `taken` by a suffix. */
export const workflowKeyOf = (base: string, taken: ReadonlySet<string>): string => {
    const slug =
        base
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .replaceAll(D_STROKE, "d")
            .split(/[^a-z0-9]/)
            .filter((part) => part !== "")
            .join("-")
            .slice(0, KEY_MAX) || "workflow"
    if (!taken.has(slug)) return slug
    const free = Array.from({ length: taken.size + 1 }, (_, at) => `${slug}-${at + 2}`).find((key) => !taken.has(key))
    return free ?? `${slug}-${taken.size + 2}`
}
