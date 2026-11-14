import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { NodeLocale } from "../../nodes/node-schema.types"
import { UNSTATED_TALLY } from "../../rows/figure-format"
import { graphViewOfSpec } from "../../rows/graph-spec-view"
import type { GraphView } from "../../rows/graph-view"
import type { CommandView, DecisionQueueView, DecisionRowView } from "../../views/views.types"
import { type AgentRunRow, type RunLocale, whenOf } from "./agent-runs"
import en from "./messages/en.json"
import vi from "./messages/vi.json"
import type { AgentFlowsView, AgentRunFacts, WaitingCommand, WaitingOnPersonFacts, WaitingRow } from "./platform.types"

/*
 * What the reads of the agent's work desk make of the `platform.agent-desk` port's answers: the views the generic desk blocks draw.
 * No business here: the port's facts, laid out for a block, in the viewer's language.
 */

/** Joins the parts of a row's line that say something, the way every row of the desk does. */
export const DESK_SEPARATOR = " \u00b7 "

/**
 * Between the installation and the port's row id in the key of a waiting row. A queue's action is bound with no variables and runs
 * with the row key alone, so the key carries the installation the row was read under and the decision is scoped exactly like the read.
 * A uuid holds no `~`.
 */
export const DESK_ROW_KEY_SEPARATOR = "~"

/** The key of a waiting row: the installation it was read under, then the port's row id. */
export const deskRowKeyOf = (installation: string, id: string): string => `${installation}${DESK_ROW_KEY_SEPARATOR}${id}`

/** One uuid, as an installation and a work item or stop id are. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** The installation and the port's row id a waiting row's key carries: exactly one `~` between two uuids; null for anything else. */
export const deskRowOfKey = (key: string): { readonly installation: string; readonly id: string } | null => {
    const parts = key.split(DESK_ROW_KEY_SEPARATOR)
    const [installation, id] = parts
    if (parts.length !== 2 || installation === undefined || id === undefined) return null
    return UUID.test(installation) && UUID.test(id) ? { installation, id } : null
}

/** One installed workflow as the desk draws it: its name and the graph view of the version that runs (null when it does not parse). */
export interface DeskFlowView {
    /** The workflow key. */
    readonly key: string
    /** Its name. */
    readonly name: string
    /** Whether it is the agent's main workflow. */
    readonly isPrimary: boolean
    /** How many steps it has. */
    readonly steps: number
    /** The card map of its graph, the same view the workflow canvas reads; null when the stored graph does not parse. */
    readonly graph: GraphView | null
}

/** What `platform.agent-flows` answers: every active workflow of the agent, the primary first, with the totals of the head. */
export interface DeskFlowsView {
    /** How many workflows. */
    readonly workflows: number
    /** How many steps in all. */
    readonly steps: number
    /** The workflows. */
    readonly flows: ReadonlyArray<DeskFlowView>
}

/** The graph view of a stored graph text in a language; null when the text is no graph spec. */
const graphOfJson = (json: string, locale: NodeLocale): GraphView | null => {
    let raw: unknown
    try {
        raw = JSON.parse(json)
    } catch {
        return null
    }
    const parsed = graphSpecSchema.safeParse(raw)
    return parsed.success ? graphViewOfSpec(parsed.data, { locale }) : null
}

/** The language a desk view is written in: English for an English viewer, else Vietnamese. */
export const deskLocaleOf = (locale: string): NodeLocale => (locale === "en" ? "en" : "vi")

/** The flows of the port as the desk draws them: each running graph turned into the canvas's own card view, never hand-written. */
export const deskFlowsOf = (answer: AgentFlowsView, locale: NodeLocale): DeskFlowsView => {
    const flows = [...answer.flows]
        .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
        .map((flow): DeskFlowView => {
            const graph = graphOfJson(flow.graphJson, locale)
            return {
                key: flow.key,
                name: flow.name,
                isPrimary: flow.isPrimary,
                steps: graph?.nodes.length ?? 0,
                graph,
            }
        })
    return { workflows: flows.length, steps: flows.reduce((sum, flow) => sum + flow.steps, 0), flows }
}

/** The command a waiting row offers for a verdict; its words and look are the spec's (`commands` of the queue). */
const commandOf = (verdict: WaitingCommand): CommandView => ({ id: verdict, label: verdict })

/** One waiting row of the port as a decision row: who asked, when, what would change; the verdicts it offers, none for a stop answered in /chat. */
const decisionRowOf = (installation: string, row: WaitingRow, where: RunLocale): DecisionRowView => {
    const description = [row.askedBy ?? "", whenOf(row.askedAt, where), row.line]
        .filter((part) => part.trim() !== "")
        .join(DESK_SEPARATOR)
    return {
        id: deskRowKeyOf(installation, row.id),
        title: row.title,
        description,
        badges: [],
        reason: null,
        amount: null,
        proposal: "",
        trace: null,
        expiry: null,
        primary: row.commands.includes("approve") ? commandOf("approve") : null,
        alternative: row.commands.includes("decline") ? commandOf("decline") : null,
        edit: null,
        menu: [],
        waitingFor: null,
        askedAt: row.askedAt,
    }
}

/** The instant of a row, for the order: a row whose time does not parse goes last. */
const askedAtOf = (row: WaitingRow): number => {
    const at = Date.parse(row.askedAt)
    return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at
}

/**
 * What `platform.waiting-on-person` answers: the agent's runs stopped on a person as the decision queue draws them, OLDEST first (the
 * one that has waited longest is the queue's first row, the one whose "approve" is the page's primary).
 */
export const deskQueueOf = (installation: string, answer: WaitingOnPersonFacts, where: RunLocale): DecisionQueueView => ({
    count: answer.count === 0 ? null : String(answer.count),
    more: null,
    rows: [...answer.rows]
        .sort((left, right) => askedAtOf(left) - askedAtOf(right))
        .map((row) => decisionRowOf(installation, row, where)),
})

/** The words of a run's line, from the platform's own catalogue. */
const RUN_WORDS: Readonly<Record<NodeLocale, Readonly<Record<string, string>>>> = { vi, en }

/** A count as the desk shows it: the number, or a dash when calls were made and none stated a count (never 0). */
export const countText = (value: number | null): string => (value === null ? UNSTATED_TALLY : String(value))

/** The words of a key of the platform catalogue with `{count}` filled. */
const countWords = (locale: NodeLocale, key: string, value: number | null): string =>
    (RUN_WORDS[locale][key] ?? key).replace("{count}", countText(value))

/** One run of the list with the desk's facts: the question it answers, who asked, the records it read and changed, how it ended. */
export interface DeskRunRow extends AgentRunRow {
    /** The question or task, else what woke the agent: the row's headline. */
    readonly subject: string
    /** The question or task the run answers; null when it carries none. */
    readonly ask: string | null
    /** Who asked; null when the run names nobody. */
    readonly askedBy: string | null
    /** The records it read; null when not stated (a dash), or when the desk did not answer for this run. */
    readonly readCount: number | null
    /** The records it changed; null when not stated (a dash), or when the desk did not answer for this run. */
    readonly changedCount: number | null
    /** The calls whose adapter stated no count. */
    readonly uncounted: number
    /** How it ended; null when the desk did not answer for this run. */
    readonly outcome: AgentRunFacts["outcome"] | null
    /** Who asked, when, and the records read and changed, in one line. */
    readonly facts: string
}

/** A run row with the desk's facts merged by run id; a run the desk did not answer for keeps nulls (dashes), never zeros. */
export const deskRunRowOf = (row: AgentRunRow, facts: AgentRunFacts | undefined, locale: NodeLocale): DeskRunRow => {
    const readCount = facts?.readCount ?? null
    const changedCount = facts?.changedCount ?? null
    const askedBy = facts?.askedBy ?? null
    const ask = facts?.ask ?? null
    const line = [
        askedBy ?? "",
        row.when,
        countWords(locale, "desk_run_read", readCount),
        countWords(locale, "desk_run_changed", changedCount),
    ]
    return {
        ...row,
        subject: ask ?? row.trigger,
        ask,
        askedBy,
        readCount,
        changedCount,
        uncounted: facts?.uncounted ?? 0,
        outcome: facts?.outcome ?? null,
        facts: line.filter((part) => part.trim() !== "").join(DESK_SEPARATOR),
    }
}
