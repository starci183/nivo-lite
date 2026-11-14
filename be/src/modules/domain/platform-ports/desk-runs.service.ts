import { Injectable } from "@nestjs/common"
import { AgentGraphRawRowsService } from "@modules/domain/agent-graphs/agent-graph-raw-rows.service"
import { AgentRunRecordsService, type StoredRun } from "@modules/domain/agent-runs"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { askSourceOf, askerOf, dayWindowOf, runFactsOf, type AskSource, type AskerRef } from "./agent-desk.mapper"
import type { AgentRunFacts, AgentTodayView, DeskDay } from "./agent-desk.contracts"

/** The most runs one read of facts takes: a page of the runs list. */
export const RUN_FACTS_MAX = 50

/** A run of the agent as the desk reads it: its status, and the question and the asker its wake named. */
export interface DeskRun {
    /** The run. */
    readonly id: string
    /** The engine status. */
    readonly status: unknown
    /** The question or task, or null. */
    readonly ask: string | null
    /** Who asked, or null. */
    readonly askedBy: string | null
}

/** The run context of a record, or an empty one. */
const contextOf = (row: StoredRun): Readonly<Record<string, unknown>> => Object.fromEntries(Object.entries(row.context))

/** The members of a wake context that name where a pipeline event's data is kept, as the run context holds them. */
const EVENT_MEMBERS = ["declaration", "rawType", "rawRowId", "dataJson", "filesJson"] as const

/** The event members of a run context (a member that is no text is left out): what the pipeline reader reads the event's data by. */
const eventMembersOf = (context: Readonly<Record<string, unknown>>): Pick<AgentWakeContext, (typeof EVENT_MEMBERS)[number]> =>
    Object.fromEntries(
        EVENT_MEMBERS.flatMap((name) => {
            const value = context[name]
            return typeof value === "string" ? [[name, value]] : []
        }),
    )

/** The key of an asker in the names read. */
const keyOf = (asker: AskerRef): string => {
    if (asker.kind === "user") return `user:${asker.userId}`
    return asker.kind === "agent" ? `agent:${asker.agentId}` : ""
}

@Injectable()
/**
 * The runs side of an agent's desk: the question each run answers and who asked (from the wake it answers: the words of the pipeline
 * event, as the run itself read them from the stored raw row, or the words of a tag, and the person or agent who wrote it), the records its calls touched (the counts the adapters stated in
 * the call log), how it ended, and what the agent did on the workspace's day. Runs are read by id from the core runs table and kept
 * only when they belong to the agent; the day's runs are counted on the index of the agent, status and end.
 */
export class DeskRunsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly runRows: AgentRunRecordsService,
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMembersReadService,
        private readonly callLog: ToolCallLogService,
        private readonly events: AgentGraphRawRowsService,
    ) {}

    /** The runs of the agent among the ids (at most `RUN_FACTS_MAX`), with their question and asker; a run of another agent is left out. */
    async runsOf(workspaceId: string, agentId: string, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<DeskRun>> {
        const ids = [...new Set(runIds)].slice(0, RUN_FACTS_MAX)
        if (ids.length === 0) return []
        const rows = await this.engine.scoped(workspaceId, (tx) =>
            this.runRows.runRows(tx, { ids, agentId, order: "started" }, ids.length),
        )
        const byId = new Map(rows.map((row) => [row.id, row]))
        const mine = ids.flatMap((id) => {
            const row = byId.get(id)
            return row === undefined ? [] : [row]
        })
        const contexts = mine.map((row) => ({ row, context: contextOf(row) }))
        const askers = contexts.map(({ context }) => askerOf(context))
        const [asks, names] = await Promise.all([
            Promise.all(contexts.map(({ context }) => this.askOf(workspaceId, context, askSourceOf(context)))),
            this.namesOf(workspaceId, askers),
        ])
        return contexts.map(({ row }, index) => {
            const asker = askers[index]
            return {
                id: row.id,
                status: row.status,
                ask: asks[index] ?? null,
                askedBy: asker === undefined ? null : (names.get(keyOf(asker)) ?? null),
            }
        })
    }

    /** The desk facts of the runs of the agent among the ids: question, asker, records touched and how each ended. */
    async runFacts(
        workspaceId: string,
        agentId: string,
        runIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<AgentRunFacts>> {
        const runs = await this.runsOf(workspaceId, agentId, runIds)
        const tallies = await this.callLog.recordsOfRuns(
            workspaceId,
            runs.map((run) => run.id),
        )
        const byRun = new Map(tallies.map((tally) => [tally.runId, tally]))
        return runs.map((run) => runFactsOf(run, run.ask, run.askedBy, byRun.get(run.id)))
    }

    /**
     * What the agent did on the workspace's day: the runs that finished done that day (`agent_status_ended`: agent, status, end), and the
     * records the day's calls read and changed as their adapters stated them.
     */
    async today(workspaceId: string, agentId: string, day: DeskDay): Promise<AgentTodayView> {
        const window = dayWindowOf(day)
        const [groups, tally] = await Promise.all([
            this.engine.scoped(workspaceId, (tx) =>
                this.runRows.runCounts(tx, {
                    agentId,
                    statuses: ["done"],
                    ended: { from: window.from.toISOString(), to: window.to.toISOString() },
                }),
            ),
            this.callLog.recordsOfAgent({ workspaceId, agentId, from: window.from, to: window.to }),
        ])
        return {
            day: window.day,
            answered: groups.reduce((sum, group) => sum + group.count, 0),
            recordsRead: tally.read,
            recordsChanged: tally.changed,
            uncounted: tally.uncounted,
        }
    }

    /**
     * The words of a run's question: the pipeline event it answers (its `data.text`, rebuilt from the raw row its context names by the one
     * reader the run used, only a row of one of the workspace's own connections), or the words a tag carried; null when none (an event
     * with no words, a row retention removed).
     */
    private async askOf(workspaceId: string, context: Readonly<Record<string, unknown>>, source: AskSource): Promise<string | null> {
        if (source.kind === "text") return source.text
        if (source.kind === "none") return null
        const { text } = await this.events.pipelineDataOf({ workspaceId, context: eventMembersOf(context) })
        return typeof text === "string" && text !== "" ? text : null
    }

    /** The names of the askers: the person's seat name, or the agent's name; one read of each. */
    private async namesOf(workspaceId: string, askers: ReadonlyArray<AskerRef>): Promise<ReadonlyMap<string, string>> {
        const users = askers.flatMap((asker) => (asker.kind === "user" ? [asker.userId] : []))
        const agentIds = askers.flatMap((asker) => (asker.kind === "agent" ? [asker.agentId] : []))
        const [people, agents] = await Promise.all([
            this.members.namesOf(workspaceId, users),
            this.agents.cardsOf(workspaceId, [...new Set(agentIds)]),
        ])
        return new Map([
            ...people.map((person): readonly [string, string] => [`user:${person.userId}`, person.displayName]),
            ...agents.map((agent): readonly [string, string] => [`agent:${agent.id}`, agent.name]),
        ])
    }
}
