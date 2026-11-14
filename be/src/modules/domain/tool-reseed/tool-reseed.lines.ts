import type { ReseedRefusal, ReseedReport } from "./tool-reseed.contracts"
import {
    BY_HAND_DRAIN,
    HISTORY_STORES,
    RESEED_STORES,
    RESEED_STORE_WORDS,
    countWordsOf,
    type StoreCount,
} from "./tool-reseed.policy"

const REFUSAL_WORDS: Readonly<Record<ReseedRefusal, string>> = {
    bad_map: "the map file must hold { tools: { <old id>: <new id> } }; nothing read",
    not_drained: "something is open (see the drain line of each workspace): nothing written; drain, then run again",
}

/**
 * What the verb cannot do itself and needs: printed with every report, so the restart owner knows what is left by design.
 */
export const RESEED_NEEDS: ReadonlyArray<string> = [
    "old workflow and graph versions are NOT deleted: agent_workflow_versions and agent_graph_versions are append-only, and run pins (history) point at them; the new version is the one that runs",
    "a replaced workflow keeps its OLD template provenance (AgentWorkflowsService.publish keeps the link): needs AgentWorkflowsService.reseedFromTemplate(workspaceId: string, workflowId: string, expected: ExpectedLatest): Promise<WorkflowVersionView> (kind template, provenance at the current version, no merge)",
]

/** The four counts of one store, slash-separated. */
const shortOf = (count: StoreCount): string => `${count.found}/${count.rewritten}/${count.removed}/${count.orphans}`

/** What a run did, in the paste line's words. */
const modeOf = (report: ReseedReport): string => {
    if (report.executed) return "EXECUTED"
    return report.refusal === null ? "dry run" : `REFUSED ${report.refusal}`
}

/** The suffix naming the version a plan writes, or nothing. */
const versionOf = (toVersion: number | null): string => (toVersion === null ? "" : ` -> v${toVersion}`)

/** The paste line of a set of totals. */
const pasteOf = (report: ReseedReport): string => {
    const stores = RESEED_STORES.map((store) => `${store} ${shortOf(report.totals[store])}`).join("; ")
    const mode = modeOf(report)
    return `tools reseed ${mode}: workspaces ${report.workspaces.length}, failed ${report.failed}; found/rewritten/removed/orphans: ${stores}`
}

/** The lines a re-seed prints: per workspace the drain and the counts of each store, what was left and why, then the paste line. */
export const reseedLinesOf = (report: ReseedReport): ReadonlyArray<string> => {
    if (report.refusal === "bad_map") return [`tools reseed REFUSED (bad_map): ${REFUSAL_WORDS.bad_map}`]
    const head = report.executed ? "EXECUTED" : "dry run: nothing written; pass --execute to write exactly this"
    return [
        `tools reseed map ${report.mapPath} (${head})`,
        ...(report.refusal === null ? [] : [`tools reseed REFUSED (${report.refusal}): ${REFUSAL_WORDS[report.refusal]}`]),
        ...report.workspaces.flatMap((part) => [
            `workspace ${part.workspaceId} drain ${Object.entries(part.drain)
                .map(([key, count]) => `${key}=${count}`)
                .join(" ")}`,
            ...RESEED_STORES.map(
                (store) => `  ${RESEED_STORE_WORDS[store]}: ${countWordsOf(part.counts[store], report.executed)}`,
            ),
            ...part.plans
                .filter((plan) => plan.action !== "current")
                .map(
                    (plan) =>
                        `  ${plan.action} workflow=${plan.workflowId} template=${plan.templateId ?? "none"}${versionOf(plan.toVersion)} old ids ${plan.oldIds}`,
                ),
            ...part.notes.map((note) => `  ${note}`),
            ...part.failed.map((failure) => `  FAILED agent=${failure.agentId} ${failure.code}`),
        ]),
        "the tool grants are re-keyed first (an old id carried onto its successor in the same mode), then the workflows are written",
        `check by hand before --execute (block 0 of 20261112014200, read only): ${BY_HAND_DRAIN.join("; ")}`,
        `never written: ${HISTORY_STORES.join(", ")}`,
        ...RESEED_NEEDS.map((need) => `needs: ${need}`),
        pasteOf(report),
    ]
}
