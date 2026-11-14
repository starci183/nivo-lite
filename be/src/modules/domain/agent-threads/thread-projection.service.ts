import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    AgentRunRecordsService,
    DEFAULT_DEADLINE_MS,
    type RunValues,
    type StepJson,
    type StepValues,
    type StoredRun,
    type StoredStep,
} from "@modules/domain/agent-runs"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    ThreadProjectionOutcome,
    ThreadReplayParams,
    ThreadRunEndParams,
    ThreadRunRefParams,
    ThreadRunResumeParams,
    ThreadStepCallParams,
    ThreadStepEndParams,
    ThreadStepFactParams,
    ThreadStepParams,
    ThreadStepStopParams,
} from "./thread-projection.contracts"

/** The engine a thread's run is marked with. */
const THREAD_ENGINE = "langgraph"

/** The most door calls one step row keeps (the entity's bound). */
const CALLS_KEPT = 50

/** How often a write is tried again after another writer moved the row first. */
const WRITE_TRIES = 3

/** The statuses of a run a thread still moves; any other is closed and only its steps are written. */
const OPEN_RUN: ReadonlySet<string> = new Set(["running", "waiting"])

/** The code a waiting run shows while a person holds its conversation after a stop (`take_over`). */
export const TAKEN_OVER = "taken_over"

/** The code a run skipped by a founder ends with when the skip names none. */
const SKIPPED = "skipped"

/** How far a step has come within one try: begun, stopped, ended. A later fact of the same try is the higher one. */
const RANK = { started: 0, stopped: 1, ended: 2 } as const

type Rank = (typeof RANK)[keyof typeof RANK]

/** What one step fact asks of the rows. */
type StepFact = ThreadStepFactParams

/** The answer of one try of a write: done with an outcome, or tried again because another writer moved a row first. */
type Tried = ThreadProjectionOutcome | "stale"

const iso = (at: Date): string => at.toISOString()

/** True for a value JSON carries whole: scalars, lists and plain objects; an undefined member of an object is left out, as JSON does. */
const isJson = (value: unknown): value is JsonValue => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true
    if (typeof value === "number") return Number.isFinite(value)
    if (Array.isArray(value)) return value.every((item) => isJson(item))
    return typeof value === "object" && Object.values(value).every((member) => member === undefined || isJson(member))
}

/** A JSON object of a step as the row keeps it; null when JSON cannot carry it (the write is refused, never half). */
const recordOf = (value: object): StepJson | null => (isJson(value) && isRecord(value) ? value : null)

/** A JSON object of a fact the row keeps, or null when it is none or JSON cannot carry it. */
const recordOrNull = (value: object | null): StepJson | null => (value === null ? null : recordOf(value))

/** The rank a step row already holds within its try; a pending row has none yet. */
const rankOfRow = (data: StoredStep): Rank | -1 => {
    const status = data.status
    if (status === "running") return data.waitItemId === null ? RANK.started : RANK.stopped
    if (status === "failed") return RANK.stopped
    if (status === "done" || status === "compensating" || status === "compensated") return RANK.ended
    return -1
}

/** True when the row already says something later than the fact: a higher try, or the same try further on. */
const laterThan = (data: StoredStep, attempt: number, rank: Rank): boolean => {
    const held = data.attempt
    return held > attempt || (held === attempt && rankOfRow(data) > rank)
}

/** The door calls as the row keeps them, at most the entity's bound. */
const callsOf = (calls: ReadonlyArray<ThreadStepCallParams>): StepJson => ({
    calls: calls.slice(0, CALLS_KEPT).map((call) => ({
        tool: call.tool,
        ok: call.ok,
        effectKey: call.effectKey,
        ...(call.failure === null ? {} : { failure: call.failure }),
    })),
})

/** The spec of a step as the row keeps it: its node, kind, effect and input. */
interface SpecValues {
    readonly nodeKey: string
    readonly kind: string
    readonly effect: StepJson
    readonly input: StepJson
}

/** The spec of a step fact as the row keeps it; null when JSON cannot carry its effect or its input. */
const specOf = (fact: ThreadStepParams): SpecValues | null => {
    const effect = recordOf(fact.spec.effect)
    const input = recordOf(fact.spec.input)
    return effect === null || input === null ? null : { nodeKey: fact.spec.nodeKey, kind: fact.spec.kind, effect, input }
}

/** What a step row holds whatever the fact: the step itself, as the old engine's spec would have written it. */
const specValuesOf = (spec: SpecValues, fact: ThreadStepParams): StepValues => ({
    ...spec,
    attempt: fact.attempt,
    maxAttempts: Math.max(fact.spec.maxAttempts ?? 1, fact.attempt),
    // The deadline the old engine fills a spec that names none with (`filled`): a step row the run reader can read (D-P10-6).
    deadlineMs: fact.spec.deadlineMs ?? DEFAULT_DEADLINE_MS,
})

/** When this try began: the row's own moment when the row is of the same try, else the fact's. */
const startedOf = (row: StoredStep | null, fact: ThreadStepParams): string => {
    const held = row?.startedAt ?? null
    return held !== null && row?.attempt === fact.attempt ? held : iso(fact.at)
}

/** When this try ended: the row's own moment when it already ended this try the same way, else the fact's. */
const endedOf = (row: StoredStep | null, fact: ThreadStepParams, status: string): string => {
    const held = row?.endedAt ?? null
    const same = row?.attempt === fact.attempt && row.status === status
    return held !== null && same ? held : iso(fact.at)
}

const durationOf = (started: string, ended: string): number =>
    Math.max(0, new Date(ended).getTime() - new Date(started).getTime())

/** The fields a step fact writes, against the row as it stands (null when there is none yet); null when JSON cannot carry them. */
const stepValuesOf = (row: StoredStep | null, fact: StepFact): StepValues | null => {
    const spec = specOf(fact)
    if (spec === null) return null
    const startedAt = startedOf(row, fact)
    if (fact.kind === "started")
        return {
            ...specValuesOf(spec, fact),
            status: "running",
            startedAt,
            endedAt: null,
            durationMs: null,
            result: null,
            errorCode: null,
            error: null,
            waitItemId: null,
            doorCalls: { calls: [] },
        }
    if (fact.kind === "ended") {
        const status = fact.code === null ? "done" : "failed"
        const endedAt = endedOf(row, fact, status)
        const result = recordOf(fact.result)
        if (result === null) return null
        return {
            ...specValuesOf(spec, fact),
            status,
            startedAt,
            endedAt,
            durationMs: durationOf(startedAt, endedAt),
            result,
            errorCode: fact.code,
            error: fact.code === null ? null : { code: fact.code },
            waitItemId: null,
            ...(fact.workItemId === null ? {} : { workItemId: fact.workItemId }),
            doorCalls: callsOf(fact.calls),
        }
    }
    const waiting = fact.waitItemId !== null
    const status = waiting ? "running" : "failed"
    const endedAt = waiting ? null : endedOf(row, fact, status)
    return {
        ...specValuesOf(spec, fact),
        status,
        startedAt,
        endedAt,
        durationMs: endedAt === null ? null : durationOf(startedAt, endedAt),
        result: null,
        errorCode: fact.code,
        error: recordOrNull({ ...fact.error, code: fact.code }),
        waitItemId: fact.waitItemId,
        ...(fact.waitItemId === null ? {} : { workItemId: fact.waitItemId }),
        doorCalls: callsOf(fact.calls),
    }
}

/** The fields a step fact changes on its run: the step counter always; the status only while the run is open (running or waiting). */
const runValuesOfStep = (run: StoredRun, fact: StepFact): RunValues => {
    const stepSeq = Math.max(run.stepSeq, fact.ordinal)
    if (!OPEN_RUN.has(run.status)) return { stepSeq }
    if (fact.kind === "stopped") return { stepSeq, status: "waiting", error: { code: fact.code } }
    return { stepSeq, status: "running", error: null }
}

/** The fields a thread's end writes on its run; null when the run is already closed. */
const runValuesOfEnd = (run: StoredRun, end: ThreadRunEndParams): RunValues | null => {
    if (!OPEN_RUN.has(run.status)) return null
    const at = iso(end.at)
    if (end.outcome === "done") return { status: "done", error: null, endedAt: at }
    if (end.outcome === "skipped")
        return {
            status: "cancelled",
            error: { code: end.code ?? SKIPPED },
            cancelledAt: at,
            cancelledBy: end.by,
            endedAt: at,
        }
    // A thread that could not go on was told to the founder through its stop: the old engine's sweep must never tell it again.
    return { status: "failed", error: { code: end.code ?? "failed" }, endedAt: at, deadLetteredAt: at }
}

/** The members of an object that JSON keeps, by name. */
const membersOf = (value: object): ReadonlyMap<string, unknown> =>
    new Map(Object.entries(value).filter(([, member]) => member !== undefined))

/** True when two JSON values say the same: equal scalars, equal lists in order, objects with the same members in any order. */
const sameJson = (left: unknown, right: unknown): boolean => {
    if (left === right) return true
    if (Array.isArray(left) || Array.isArray(right))
        return (
            Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((item, index) => sameJson(item, right[index]))
        )
    if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false
    const [mine, theirs] = [membersOf(left), membersOf(right)]
    return (
        mine.size === theirs.size &&
        [...mine].every(([key, member]) => theirs.has(key) && sameJson(member, theirs.get(key)))
    )
}

/** True when every field of `values` already holds that value on the row. */
const holds = (row: StoredRun | StoredStep, values: RunValues | StepValues): boolean => {
    const data = new Map<string, unknown>(Object.entries(row))
    return Object.entries(values).every(([key, value]) => value === undefined || sameJson(data.get(key) ?? null, value))
}

/** What a write answers: written, or stale when another writer moved the row first (or a unique key holds it). */
const writtenOf = (row: object | null): Tried => (row === null ? "stale" : "written")

/** Runs `write` again while another writer moved a row first, at most `left` times; still losing the race is a refusal. */
const untilSettled = async (left: number, write: () => Promise<Tried>): Promise<ThreadProjectionOutcome> => {
    const answer = await write()
    if (answer !== "stale") return answer
    return left > 1 ? untilSettled(left - 1, write) : "refused"
}

@Injectable()
/**
 * Writes the progress of a LangGraph thread into the run and step rows the run page, the board and the reports already read: the run is
 * the thread, a step row is a node of it, keyed by run and step key. The rows only show; nothing reads them to decide how a thread resumes.
 *
 * Every write is idempotent and monotone. A step fact carries its try and how far the try came (started, stopped, ended); a fact older
 * than what the row holds is kept out, and a fact the row already holds writes nothing, so a replayed step leaves the same one row, the
 * first moments of a try stay, and `repair` can replay all the facts of a thread at any time and get the same rows. Each call runs in
 * its own scoped transaction, or in the caller's when `manager` is given, and is tried again when another writer moved a row first.
 *
 * Called by the thread runs (start, resume, end) and the node function (step start, end, stop); the sweep calls `repair`.
 */
export class ThreadProjectionService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentRunRecordsService,
    ) {}

    /** Marks the run as a thread's: `engine` is `langgraph`. Called once the run row is open, before the first step. */
    runStarted(ref: ThreadRunRefParams, manager?: EntityManager): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) => this.patchRun(tx, ref.runId, () => ({ engine: THREAD_ENGINE })))
    }

    /** A step began a try: its row is written (or found, on a replay) as running and the run runs. */
    stepStarted(
        ref: ThreadRunRefParams,
        step: ThreadStepParams,
        manager?: EntityManager,
    ): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) => this.stepIn(tx, ref.runId, { kind: "started", ...step }))
    }

    /** A step ended its try: done with its result and door calls, or failed and passed over. */
    stepEnded(
        ref: ThreadRunRefParams,
        step: ThreadStepEndParams,
        manager?: EntityManager,
    ): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) => this.stepIn(tx, ref.runId, { kind: "ended", ...step }))
    }

    /** A step stopped the thread: the step shows why (or waits on its approval) and the run waits for a person. */
    stepStopped(
        ref: ThreadRunRefParams,
        step: ThreadStepStopParams,
        manager?: EntityManager,
    ): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) => this.stepIn(tx, ref.runId, { kind: "stopped", ...step }))
    }

    /** The thread resumed after a stop: the run runs again. The stopped step moves when its next try starts. */
    resumed(
        ref: ThreadRunRefParams,
        resume: ThreadRunResumeParams,
        manager?: EntityManager,
    ): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) =>
            this.patchRun(tx, ref.runId, (run) =>
                run.status === "waiting" ? { status: "running", error: null, resumedAt: iso(resume.at) } : null,
            ),
        )
    }

    /**
     * A person took the conversation over at a stop: the thread stays at the gate, so the run keeps waiting, now with the code
     * `taken_over` (and who) where a stop shows its step's code, so the run page tells "a person holds it" from "waiting for a decision".
     */
    takenOver(ref: ThreadRunRefParams, by: string | null, manager?: EntityManager): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) =>
            this.patchRun(tx, ref.runId, (run) =>
                OPEN_RUN.has(run.status)
                    ? { status: "waiting", error: { code: TAKEN_OVER, ...(by === null ? {} : { by }) } }
                    : null,
            ),
        )
    }

    /** The thread ended: done, skipped by a founder (the run reads as cancelled by them) or failed. A closed run is left as it is. */
    runEnded(
        ref: ThreadRunRefParams,
        end: ThreadRunEndParams,
        manager?: EntityManager,
    ): Promise<ThreadProjectionOutcome> {
        return this.tried(ref, manager, (tx) => this.patchRun(tx, ref.runId, (run) => runValuesOfEnd(run, end)))
    }

    /**
     * Writes the rows again from what the thread's state says: the run is marked, every step fact is applied in order, then the end. A
     * row that was lost comes back, a row that lags catches up, and a row already right is not touched. Answers `written` when any row
     * changed.
     */
    async repair(
        ref: ThreadRunRefParams,
        replay: ThreadReplayParams,
        manager?: EntityManager,
    ): Promise<ThreadProjectionOutcome> {
        const outcomes: Array<ThreadProjectionOutcome> = [await this.runStarted(ref, manager)]
        if (outcomes[0] === "missing") return "missing"
        await eachInOrder(replay.steps, async (fact) => {
            outcomes.push(await this.tried(ref, manager, (tx) => this.stepIn(tx, ref.runId, fact)))
        })
        if (replay.end !== null) outcomes.push(await this.runEnded(ref, replay.end, manager))
        if (outcomes.includes("refused")) return "refused"
        return outcomes.includes("written") ? "written" : "kept"
    }

    /**
     * Applies one step fact, then makes the run follow it. The run follows a fact the step row already holds too (a replay, a repair),
     * so a run left behind by a write that lost its race catches up on the next call; a fact older than the row moves nothing.
     */
    private async stepIn(tx: ScopedTx, runId: string, fact: StepFact): Promise<Tried> {
        if ((await this.records.runRow(tx, runId)) === null) return "missing"
        const row = await this.stepRowOf(tx, runId, fact.spec.stepKey)
        if (row !== null && laterThan(row, fact.attempt, RANK[fact.kind])) return "kept"
        const values = stepValuesOf(row, fact)
        if (values === null) return "refused"
        const step = row !== null && holds(row, values) ? "kept" : await this.writeStep(tx, runId, row, fact, values)
        if (step !== "written" && step !== "kept") return step
        const moved = await untilSettled(WRITE_TRIES, () =>
            this.patchRun(tx, runId, (data) => runValuesOfStep(data, fact)),
        )
        return step === "written" && moved === "kept" ? "written" : moved
    }

    private async writeStep(
        tx: ScopedTx,
        runId: string,
        row: StoredStep | null,
        fact: StepFact,
        values: StepValues,
    ): Promise<Tried> {
        if (row !== null) return writtenOf(await this.records.patchStepRow(tx, row, values))
        const spec = specOf(fact)
        if (spec === null) return "refused"
        return writtenOf(
            await this.records.insertStep(tx, {
                ...values,
                ...spec,
                runId,
                ordinal: fact.ordinal,
                stepKey: fact.spec.stepKey,
                compAttempts: 0,
                claimedUntil: null,
                notBefore: null,
            }),
        )
    }

    /** Writes what `build` asks of the run under the version read; `kept` when it asks nothing or the run already says it. */
    private async patchRun(
        tx: ScopedTx,
        runId: string,
        build: (run: StoredRun) => RunValues | null,
    ): Promise<Tried> {
        const run = await this.records.runRow(tx, runId)
        if (run === null) return "missing"
        const values = build(run)
        if (values === null || holds(run, values)) return "kept"
        return writtenOf(await this.records.patchRunRow(tx, run, values))
    }

    /** The row of one step of a run, or null; read in the run order, as the run page reads them. */
    private async stepRowOf(tx: ScopedTx, runId: string, stepKey: string): Promise<StoredStep | null> {
        return (await this.records.stepRowsOf(tx, runId)).find((row) => row.stepKey === stepKey) ?? null
    }

    /** Runs one write in a scope, again from a fresh read while another writer moved a row first, at most `WRITE_TRIES` times. */
    private tried(
        ref: ThreadRunRefParams,
        manager: EntityManager | undefined,
        work: (tx: ScopedTx) => Promise<Tried>,
    ): Promise<ThreadProjectionOutcome> {
        return untilSettled(WRITE_TRIES, () =>
            manager === undefined
                ? this.engine.scoped(ref.workspaceId, work)
                : this.engine.within(manager, ref.workspaceId, work),
        )
    }
}
