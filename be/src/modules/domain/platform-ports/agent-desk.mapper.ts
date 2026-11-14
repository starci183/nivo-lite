import type { RunStop } from "@modules/domain/agent-threads"
import type { AgentNodeRights } from "@modules/domain/node-right-rollups"
import type { ProviderBoard } from "@modules/domain/tools"
import type { CallRecordsTally } from "@modules/domain/tool-call-log"
import { ABILITY_SEPARATOR, pick } from "./platform-regions.policy"
import type {
    AgentReachView,
    AgentRunFacts,
    DeskDay,
    ReachAccount,
    RunOutcome,
    WaitingCommand,
    WaitingRow,
} from "./agent-desk.contracts"

/** The facts an approval stop keeps for the engine itself (`ThreadApprovalsService.asked`): never part of what would change. */
const ENGINE_FACTS: ReadonlySet<string> = new Set([
    "tool",
    "ability",
    "account",
    "workItemId",
    "fingerprint",
    "verdict",
])

/** The verdicts of an approval, in the order the row offers them (the primary last). */
const APPROVAL_COMMANDS: ReadonlyArray<WaitingCommand> = ["decline", "approve"]

/** The value of a fact of a stop, or null. */
export const stopFactOf = (stop: RunStop, name: string): string | null =>
    stop.detail.facts.find((fact) => fact.name === name)?.value ?? null

/** The id a waiting row carries: the work item of an approval (what the decide door takes), else the stop. */
export const waitingIdOf = (stop: RunStop): string =>
    stop.kind === "approval" ? (stopFactOf(stop, "workItemId") ?? stop.id) : stop.id

/**
 * What a stop would change, from the structured facts it holds: for an approval the ability and the account it acts on, then each
 * argument of the call in plain words (as the card lists them); for any other stop the question it asks, else nothing.
 */
export const waitingLineOf = (stop: RunStop): string => {
    if (stop.kind !== "approval") return stop.question ?? ""
    const where = [stopFactOf(stop, "ability"), stopFactOf(stop, "account")].filter((part) => part !== null)
    const args = stop.detail.facts
        .filter((fact) => !ENGINE_FACTS.has(fact.name))
        .map((fact) => `${fact.name}: ${fact.value}`)
    return [...where, ...args].join(ABILITY_SEPARATOR)
}

/** One waiting row of a stop, with who asked for the run's work. */
export const waitingRowOf = (stop: RunStop, askedBy: string | null): WaitingRow => ({
    id: waitingIdOf(stop),
    runId: stop.runId,
    title: stop.reason,
    askedBy,
    askedAt: stop.stoppedAt,
    line: waitingLineOf(stop),
    commands: stop.kind === "approval" && stopFactOf(stop, "workItemId") !== null ? APPROVAL_COMMANDS : [],
})

/** The engine statuses a run stopped in (on a person, a wait, or a person's cancel), and the ones it failed in. */
const STOPPED: ReadonlySet<string> = new Set(["waiting", "parked", "cancelled"])
const FAILED: ReadonlySet<string> = new Set(["failed", "dead"])

/** How a run ended: done is `changed` when its calls changed a record, else `answered`; a status this build does not know still runs. */
export const runOutcomeOf = (status: unknown, changed: number | null): RunOutcome => {
    const known = typeof status === "string" ? status : ""
    if (FAILED.has(known)) return "failed"
    if (STOPPED.has(known)) return "stopped"
    if (known === "done" || known === "compensated") return changed !== null && changed > 0 ? "changed" : "answered"
    return "running"
}

/**
 * Where the question of a run is read from: the event of the one pipeline it answers (its words are the event's `data.text`, rebuilt from
 * the stored raw row the run's context names, as the run itself read it), the words a tag carried, or nothing.
 */
export type AskSource = { readonly kind: "event" } | { readonly kind: "text"; readonly text: string } | { readonly kind: "none" }

/** Who asked for a run's work: the account of a person, an agent, or nobody named. */
export type AskerRef =
    | { readonly kind: "user"; readonly userId: string }
    | { readonly kind: "agent"; readonly agentId: string }
    | { readonly kind: "none" }

/** A non-empty text member of a run context, or null. */
const textIn = (context: Readonly<Record<string, unknown>>, name: string): string | null => {
    const value = context[name]
    return typeof value === "string" && value !== "" ? value : null
}

/** The question of a run, as its context (the wake it answers) names it. */
export const askSourceOf = (context: Readonly<Record<string, unknown>>): AskSource => {
    // A run of the one pipeline: its producer named the verb and the event's id (`deliver`); its words are the event's data, read from the
    // raw row (`rawType` + `rawRowId`) or the carried data (`dataJson`) the context names, never from a conversation record.
    if (textIn(context, "verb") !== null && textIn(context, "eventId") !== null) return { kind: "event" }
    const text = textIn(context, "text")
    return text === null ? { kind: "none" } : { kind: "text", text }
}

/** Who asked for a run's work, as its context names them: the person who wrote the tag, else the agent that handed it on. */
export const askerOf = (context: Readonly<Record<string, unknown>>): AskerRef => {
    const userId = textIn(context, "authorUserId")
    if (userId !== null) return { kind: "user", userId }
    const agentId = textIn(context, "authorAgentId")
    return agentId === null ? { kind: "none" } : { kind: "agent", agentId }
}

/** The run row a run-list entry is read from: its id and its stored status. */
export interface RunFactsSource {
    /** The run id. */
    readonly id: string
    /** The stored status, not yet narrowed. */
    readonly status: unknown
}

/** The workspace day: its date and the instants it starts and ends. */
export interface DayWindow {
    /** The date, `YYYY-MM-DD`. */
    readonly day: string
    /** The instant the day starts. */
    readonly from: Date
    /** The instant the day ends (exclusive). */
    readonly to: Date
}

/** The facts of one run of the list, from its status, its question, who asked and the records its calls touched. */
export const runFactsOf = (
    run: RunFactsSource,
    ask: string | null,
    askedBy: string | null,
    tally: CallRecordsTally | undefined,
): AgentRunFacts => ({
    runId: run.id,
    ask,
    askedBy,
    // A run with no `ok` call has no tally: it read and changed nothing.
    readCount: tally === undefined ? 0 : tally.read,
    changedCount: tally === undefined ? 0 : tally.changed,
    uncounted: tally?.uncounted ?? 0,
    outcome: runOutcomeOf(run.status, tally === undefined ? 0 : tally.changed),
})

/** The parts of a date in a time zone, read from the platform's own calendar. */
const partsOf = (ms: number, timeZone: string): Readonly<Record<string, number>> =>
    Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
            timeZone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
            .formatToParts(new Date(ms))
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, Number(part.value)]),
    )

/** How far a time zone is ahead of UTC at an instant, milliseconds. */
const offsetAt = (ms: number, timeZone: string): number => {
    const p = partsOf(ms, timeZone)
    const wall = Date.UTC(
        p["year"] ?? 0,
        (p["month"] ?? 1) - 1,
        p["day"] ?? 1,
        p["hour"] ?? 0,
        p["minute"] ?? 0,
        p["second"] ?? 0,
    )
    return wall - (ms - (ms % 1000))
}

/** The instant a calendar day starts in a time zone (twice corrected, so a change of offset that day lands right). */
const dayStartOf = (year: number, month: number, day: number, timeZone: string): Date => {
    const wall = Date.UTC(year, month - 1, day)
    const first = wall - offsetAt(wall, timeZone)
    return new Date(wall - offsetAt(first, timeZone))
}

/** The workspace's day around now: its date `YYYY-MM-DD` and the instants it starts and ends (exclusive). */
export const dayWindowOf = (day: DeskDay): DayWindow => {
    const p = partsOf(day.now.getTime(), day.timeZone)
    const year = p["year"] ?? 1970
    const month = p["month"] ?? 1
    const date = p["day"] ?? 1
    const next = new Date(Date.UTC(year, month - 1, date + 1))
    return {
        day: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`,
        from: dayStartOf(year, month, date, day.timeZone),
        to: dayStartOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), day.timeZone),
    }
}

/** Where an account stands for the agent: a connection that does not work needs attention; one the agent is not attached to is off. */
const accountStateOf = (connected: boolean, attached: boolean): ReachAccount["state"] => {
    if (!connected) return "attention"
    return attached ? "connected" : "off"
}

/** The titles of operations, each once, in the order first met. */
const titlesOnce = (titles: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(titles)]

/**
 * What the agent may touch: each attached account with its provider's name and where it stands (the connection does not work:
 * `attention`; the agent is not attached to it: `off`), and the operations of its running steps grouped by mode, with the ones the
 * accounts offer that no running step holds. Titles in the viewer's language; an operation with no title is named by its id.
 */
export const reachOf = (rights: AgentNodeRights, board: ProviderBoard, locale: string): AgentReachView => {
    const titleOf = (operation: AgentNodeRights["rows"][number]["operation"]): string =>
        operation.title === null ? operation.id : pick(operation.title, locale)
    const granted = rights.rows
    const held = new Set(granted.map((row) => `${row.connectionId}|${row.operation.id}`))
    const accounts = rights.accounts.map((account): ReachAccount => {
        const provider = board.providers.find((one) => one.provider === account.provider)
        const view = provider?.accounts.find((one) => one.connectionId === account.connectionId)
        const attachment = board.attachments.find(
            (one) => one.agentId === rights.agentId && one.connectionId === account.connectionId,
        )
        return {
            connectionId: account.connectionId,
            name: account.name,
            providerName: provider === undefined ? account.provider : pick(provider.label, locale),
            state: accountStateOf(view?.connected === true, attachment !== undefined),
        }
    })
    return {
        accounts,
        auto: titlesOnce(granted.filter((row) => row.mode === "auto").map((row) => titleOf(row.operation))),
        ask: titlesOnce(granted.filter((row) => row.mode === "ask").map((row) => titleOf(row.operation))),
        none: titlesOnce(
            rights.accounts.flatMap((account) =>
                account.operations
                    .filter((operation) => !held.has(`${account.connectionId}|${operation.id}`))
                    .map((operation) => titleOf(operation)),
            ),
        ),
    }
}
