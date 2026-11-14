/**
 * What a workflow reset leaves of the runs it deletes, beyond what it always cleared (runs, steps, workflows, holds, memory, freezes):
 * the run state of the LangGraph engine and of the work around a run. Each kind is one statement over one table, keyed by "a run that is
 * gone": a run of a reset agent (deleted in the same transaction) or a run no row of `public.agent_runs` names any more (left by an earlier reset). The same
 * condition counts it (the dry run) and clears it, so a dry run after a reset reads zero for every kind here.
 *
 * Kept on purpose: `agent_node_effects` (the effect ledger: business dedupe keys of kept orders and bank transactions), done or failed
 * jobs and wakes (history), lesson candidates already on a truth-graph change card (the founder decides those), care timers of agents
 * outside the reset modules. Not reachable: the delayed BullMQ job of a deadline in Redis (no queue API removes a job by id, and the CLI
 * app runs the queue as a producer only); it is harmless, since a deadline that fires for a stop that no longer exists does nothing
 * (`ThreadDeadlinesService.fire` answers `closed`).
 */

/** The queues whose jobs name one run: the old engine's step job and the thread stops' deadline job. */
export const RESET_RUN_QUEUES: ReadonlyArray<string> = ["agent_step", "thread_deadline"]

/** The states of a job that has not finished. */
export const RESET_OPEN_JOB_STATES: ReadonlyArray<string> = ["queued", "running"]

/** The wake source of a thread run's own wakes (`ENGINE_THREAD_SOURCE`): the context's `subjectId` is the run. */
export const RESET_THREAD_WAKE_SOURCE = "thread"

/** The states of a wake that may still run. */
export const RESET_OPEN_WAKE_STATES: ReadonlyArray<string> = ["pending", "held", "running", "failed"]

/** The states of an owner's work item that still waits for someone. */
export const RESET_OPEN_ITEM_STATES: ReadonlyArray<string> = ["queued", "waiting_decision"]

/** The old engine's lead-freeze item: every lead freeze of the workspace goes with the reset, so every such item is orphaned. */
export const RESET_FREEZE_ITEM_ACTION = "lead_frozen"

/** The states of a care timer that will still fire. */
export const RESET_OPEN_TASK_STATES: ReadonlyArray<string> = ["open", "waiting"]

/** The states of a lesson candidate not yet put on a change card. */
export const RESET_OPEN_LESSON_STATES: ReadonlyArray<string> = ["candidate", "proposing"]

/** The table of the lesson candidates; it exists only once its migration (013400) ran, so the reset asks first. */
export const RESET_LESSON_TABLE = "public.brain_lesson_candidates"

/** The word a reset writes on what it closes instead of deleting (wakes, work items). */
export const RESET_REASON = "workflow_reset"

/** Who a kind is keyed by: the gone runs, or the reset agents. */
export type ResetKey = "runs" | "agents"

/** One kind of run state the reset clears. */
export interface ResetKind {
    /** The words the report prints. */
    readonly what: string
    /** Counts the rows the clear would touch; answers one row `{ count }`. */
    readonly count: string
    /** Deletes or closes them; answers the count of touched rows as a DELETE / UPDATE does. */
    readonly clear: string
    /** Who the statement is keyed by: `runs` takes `[workspaceId, runIds, RUN_ENTITY, ...extra]`, `agents` `[workspaceId, agentIds, ...extra]`. */
    readonly key: ResetKey
    /** The values after the key's own, used by both statements. */
    readonly extra: ReadonlyArray<unknown>
    /** The values only the clear's SET takes, after `extra` (the count must not carry a value it does not use). */
    readonly setExtra?: ReadonlyArray<unknown>
    /** True when the kind lives in a table that may not exist yet (`RESET_LESSON_TABLE`). */
    readonly optional?: boolean
}

/**
 * A run named by `expression` is gone: it is a run the reset deletes (`$2`), or no row of the runs table names it. A null name is never
 * gone (a row that names no run is not a run's row).
 */
const goneRun = (expression: string): string =>
    `(${expression} IS NOT NULL AND (${expression} = ANY($2) OR NOT EXISTS (SELECT 1 FROM public.agent_runs run WHERE run.workspace_id = $1 AND run.id::text = ${expression})))`

/** The two statements of a kind that deletes rows of one table. */
const deleting = (table: string, where: string): Pick<ResetKind, "count" | "clear"> => ({
    count: `SELECT count(*)::int AS count FROM ${table} WHERE ${where}`,
    clear: `DELETE FROM ${table} WHERE ${where}`,
})

/** The two statements of a kind that closes rows of one table in place. */
const closing = (table: string, set: string, where: string): Pick<ResetKind, "count" | "clear"> => ({
    count: `SELECT count(*)::int AS count FROM ${table} WHERE ${where}`,
    clear: `UPDATE ${table} SET ${set} WHERE ${where}`,
})

/** The run id an owner's item names: its fields' `runId`, or the run of a thread approval's key `tool-approval:<run>:<step>:…`. */
const ITEM_RUN = `COALESCE(i.proposal->'fields'->>'runId', CASE WHEN i.dedupe_key LIKE 'tool-approval:%' THEN split_part(i.dedupe_key, ':', 2) END)`

/** The kinds, in the order the reset clears them. */
export const RESET_RUN_STATE: ReadonlyArray<ResetKind> = [
    {
        what: "run stops",
        ...deleting("public.run_stops s", `s.workspace_id = $1 AND ${goneRun("s.run_id::text")}`),
        key: "runs",
        extra: [],
    },
    {
        what: "LangGraph checkpoint writes",
        ...deleting("public.agent_checkpoint_writes c", `c.workspace_id = $1 AND ${goneRun("c.thread_id")}`),
        key: "runs",
        extra: [],
    },
    {
        what: "LangGraph checkpoint values",
        ...deleting("public.agent_checkpoint_blobs c", `c.workspace_id = $1 AND ${goneRun("c.thread_id")}`),
        key: "runs",
        extra: [],
    },
    {
        what: "LangGraph checkpoints",
        ...deleting("public.agent_checkpoints c", `c.workspace_id = $1 AND ${goneRun("c.thread_id")}`),
        key: "runs",
        extra: [],
    },
    {
        what: "open step and deadline jobs",
        ...deleting(
            "public.job_outbox j",
            `j.workspace_id = $1 AND j.queue = ANY($3) AND j.state = ANY($4) AND ${goneRun("j.payload->>'runId'")}`,
        ),
        key: "runs",
        extra: [RESET_RUN_QUEUES, RESET_OPEN_JOB_STATES],
    },
    {
        what: "open thread wakes (closed dead)",
        ...closing(
            "public.agent_wakes w",
            "status = 'dead', reason = $5, finished_at = now()",
            `w.workspace_id = $1 AND w.source = $3 AND w.status = ANY($4) AND ${goneRun("w.context->>'subjectId'")}`,
        ),
        key: "runs",
        extra: [RESET_THREAD_WAKE_SOURCE, RESET_OPEN_WAKE_STATES],
        setExtra: [RESET_REASON],
    },
    {
        what: "open work items of gone runs and lead freezes (closed rejected)",
        ...closing(
            "public.work_items i",
            "status = 'rejected', error = $5, completed_at = now()",
            `i.workspace_id = $1 AND i.status = ANY($3) AND (i.action = $4 OR ${goneRun(ITEM_RUN)})`,
        ),
        key: "runs",
        extra: [RESET_OPEN_ITEM_STATES, RESET_FREEZE_ITEM_ACTION],
        setExtra: [RESET_REASON],
    },
    {
        what: "open care timers of the reset agents (dropped)",
        ...closing(
            "public.agent_tasks t",
            "status = 'dropped', done_at = now(), next_action_at = NULL, waiting_on = NULL",
            "t.workspace_id = $1 AND t.agent_id::text = ANY($2) AND t.status = ANY($3)",
        ),
        key: "agents",
        extra: [RESET_OPEN_TASK_STATES],
    },
    {
        what: "open lesson candidates of gone runs (declined)",
        ...closing(
            `${RESET_LESSON_TABLE} b`,
            "status = 'declined'",
            `b.workspace_id = $1 AND b.status = ANY($3) AND ${goneRun("b.run_id::text")}`,
        ),
        key: "runs",
        extra: [RESET_OPEN_LESSON_STATES],
        optional: true,
    },
]

/** Who a reset is about: the workspace, its reset agents and the runs of those agents it deletes. */
export interface ResetScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The agents of the reset modules. */
    readonly agents: ReadonlyArray<string>
    /** The runs of those agents, read before they are deleted. */
    readonly runs: ReadonlyArray<string>
}

/** The values of a kind's count, in its key's order. */
export const resetCountValuesOf = (kind: ResetKind, scope: ResetScope): ReadonlyArray<unknown> =>
    kind.key === "runs"
        ? [scope.workspaceId, scope.runs, ...kind.extra]
        : [scope.workspaceId, scope.agents, ...kind.extra]

/** The values of a kind's clear: the count's, then what only its SET takes. */
export const resetClearValuesOf = (kind: ResetKind, scope: ResetScope): ReadonlyArray<unknown> => [
    ...resetCountValuesOf(kind, scope),
    ...(kind.setExtra ?? []),
]
