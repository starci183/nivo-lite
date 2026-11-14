import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import type {
    AgentDesk,
    AgentRunFacts,
    CoreReads,
    CoreRun,
    CoreRunCount,
    CoreRunStep,
    CoreRunsQuery,
} from "../platform.types"
import { agentDeskPort, coreReadsPort } from "../ports"

/** The viewer and the instant of the runs reads in the specs. */
export const RUNS_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-05T08:10:00.000Z"),
    timeZone: "UTC",
    locale: "en",
}

/** The installation of the specs and the agent it runs. */
export const INSTALLATION_ID = "0b6f7c1e-3a53-4a3f-9d52-2d7e8b5f1c11"
export const AGENT_ID = "6f1c3a52-0f0b-4b57-9a2c-1c2f6d7e8a90"

/** A run of the agent of the specs, with the members given. */
export const coreRun = (id: string, members: Partial<CoreRun> = {}): CoreRun => ({
    id,
    agentId: AGENT_ID,
    trigger: "",
    status: "running",
    startedAt: "2026-11-05T08:00:00.000Z",
    endedAt: null,
    parkReason: null,
    waitWorkItemId: null,
    ...members,
})

/** A step of a run, with the members given. */
export const coreStep = (id: string, members: Partial<CoreRunStep> = {}): CoreRunStep => ({
    id,
    stepKey: id,
    nodeKey: id,
    status: "pending",
    input: {},
    result: null,
    startedAt: null,
    durationMs: null,
    doorCalls: { calls: [] },
    effectKey: null,
    errorCode: null,
    waitItemId: null,
    ...members,
})

const unused = (): Promise<never> => Promise.reject(new Error("unused"))

/** What the recorded core reads answer besides their runs and steps. */
export interface RecordedCoreOptions {
    /** The installations the workspace has, with the agent each runs; the installation of the specs by default. */
    readonly agents?: Readonly<Record<string, string>>
    /** The steps of the runs. */
    readonly steps?: ReadonlyArray<CoreRunStep>
    /** The cursor of the next page; none by default. */
    readonly next?: string | null
    /** The counts by status; none by default. */
    readonly counts?: ReadonlyArray<CoreRunCount>
}

/** The core reads a read under test runs on, and what it was asked. */
export interface RecordedCore {
    /** The port implementation. */
    readonly core: CoreReads
    /** Every page of runs the read asked. */
    readonly lists: Array<CoreRunsQuery>
    /** Every count the read asked: the agent and the statuses. */
    readonly counted: Array<{ readonly agent: string; readonly statuses: ReadonlyArray<string> | undefined }>
    /** Every run id the read got. */
    readonly gets: Array<string>
    /** Every run whose steps the read asked, with the most it asked. */
    readonly stepsAsked: Array<{ readonly runId: string; readonly limit: number }>
}

/** Core reads that list the runs given (with `next` as the cursor of the page), get the run of an id and answer the steps and counts given. */
export const recordedCore = (runs: ReadonlyArray<CoreRun>, options: RecordedCoreOptions = {}): RecordedCore => {
    const lists: Array<CoreRunsQuery> = []
    const counted: Array<{ readonly agent: string; readonly statuses: ReadonlyArray<string> | undefined }> = []
    const gets: Array<string> = []
    const stepsAsked: Array<{ readonly runId: string; readonly limit: number }> = []
    const agents = options.agents ?? { [INSTALLATION_ID]: AGENT_ID }
    const core: CoreReads = {
        agentOf: (installation) => Promise.resolve(agents[installation] ?? null),
        runs: {
            list: (query) => {
                lists.push(query)
                return Promise.resolve({ rows: runs, next: options.next ?? null })
            },
            get: (runId) => {
                gets.push(runId)
                return Promise.resolve(runs.find((run) => run.id === runId) ?? null)
            },
            steps: (runId, limit) => {
                stepsAsked.push({ runId, limit })
                return Promise.resolve(options.steps ?? [])
            },
            count: (agent, statuses) => {
                counted.push({ agent, statuses })
                return Promise.resolve(options.counts ?? [])
            },
        },
    }
    return { core, lists, counted, gets, stepsAsked }
}

/** A fake desk with the list of what it was asked. */
interface FactsDesk {
    /** The desk port. */
    readonly desk: AgentDesk
    /** The run ids of every question it was asked, in order. */
    readonly asked: Array<ReadonlyArray<string>>
}

/**
 * A desk port that answers the facts given for the runs asked (only those), records what it was asked, and nothing else: the runs
 * reads use `runFacts` alone.
 */
export const factsDesk = (facts: ReadonlyArray<AgentRunFacts> = []): FactsDesk => {
    const asked: Array<ReadonlyArray<string>> = []
    const desk: AgentDesk = {
        flows: unused,
        waiting: unused,
        decide: unused,
        today: unused,
        reach: unused,
        runFacts: (_installation, runIds) => {
            asked.push(runIds)
            return Promise.resolve(facts.filter((fact) => runIds.includes(fact.runId)))
        },
    }
    return { desk, asked }
}

/** The provider of the core reads the runs reads take, and the desk the list merges its facts from (one that answers no facts when left out). */
export const runsProvider = (core: CoreReads, desk?: AgentDesk): PortProvider => ({
    implementationOf: (port) => {
        if (port.id === coreReadsPort.id) return core
        if (port.id === agentDeskPort.id) return desk ?? factsDesk().desk
        return undefined
    },
})
