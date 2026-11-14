export type {
    AgentConnections,
    AgentKnowledge,
    CoreReads,
    CoreRun,
    CoreRunCount,
    CoreRunStep,
    CoreRunsPage,
    CoreRunsQuery,
    CoreRunsRead,
    InstallationFacts,
    InstallationSource,
    InstallationView,
    InstalledModuleFacts,
    InstalledModuleView,
    MemberDirectory,
    MemberFacts,
    ParkedRunFilter,
    ParkedRunRow,
    ParkedRuns,
    ParkedRunsView,
    RightsDirectory,
    RunStanding,
} from "@nivo-lite/agent-sdk/platform"

/*
 * The agent's work desk (`platform.agent-desk`), copied from the back end's `platform-ports/agent-desk.contracts.ts`: the door serves
 * exactly this interface under the id `platform.agent-desk`, one asker per port.
 */

/** One installed workflow of the agent, as the version that runs holds it. */
export interface DeskFlow {
    /** The workflow key. */
    readonly key: string
    /** Its name. */
    readonly name: string
    /** Whether it is the agent's main workflow. */
    readonly isPrimary: boolean
    /** The graph of the version that runs, JSON text (the blocks draw its step cards from it). */
    readonly graphJson: string
}

/** `platform.agent-flows`: the active workflows of the agent, the primary first. */
export interface AgentFlowsView {
    /** The flows. */
    readonly flows: ReadonlyArray<DeskFlow>
}

/** What a person may do with a row that waits on them. */
export type WaitingCommand = "decline" | "approve"

/** One run of the agent stopped on a person, as the port answers it. */
export interface WaitingRow {
    /** For an approval: the owner's work item the verdict goes through (what `decide` takes); else the stop. */
    readonly id: string
    /** The run. */
    readonly runId: string
    /** What the stop is about, as the engine wrote it. */
    readonly title: string
    /** Who asked the agent for the work the run does, or null when the run names nobody. */
    readonly askedBy: string | null
    /** When the run stopped, ISO. */
    readonly askedAt: string
    /** What would change, from the structured facts the stop holds. */
    readonly line: string
    /** `approve` and `decline` for an approval; none for any other stop (it is answered on its card in /chat). */
    readonly commands: ReadonlyArray<WaitingCommand>
}

/** What the port answers for the agent's runs stopped on a person, newest first. */
export interface WaitingOnPersonFacts {
    /** How many. */
    readonly count: number
    /** The rows. */
    readonly rows: ReadonlyArray<WaitingRow>
}

/** A person's verdict on an approval waiting on them. */
export interface ApprovalVerdictAsk {
    /** The row id (the approval's work item). */
    readonly id: string
    /** Approve or decline. */
    readonly verdict: WaitingCommand
}

/** What a verdict became: decided through the work engine's own door, or refused with the code that door (or the port) gave. */
export type ApprovalDecideAnswer =
    | {
          /** The work engine took the verdict. */
          readonly kind: "decided"
          /** The status of the work item after it. */
          readonly status: string
      }
    | {
          /** Nothing was decided. */
          readonly kind: "refused"
          /** `not_waiting_here`, `no_seat`, or the error code of the decide door. */
          readonly code: string
      }

/** How a run of the agent ended, or that it still runs. */
export type RunOutcome = "answered" | "changed" | "stopped" | "failed" | "running"

/** What the desk adds to one row of `platform.agent-runs`. */
export interface AgentRunFacts {
    /** The run. */
    readonly runId: string
    /** The question or task the run answers, in the words it arrived in; null when the run carries none. */
    readonly ask: string | null
    /** Who asked, or null when the run names nobody. */
    readonly askedBy: string | null
    /** The records its calls read; null when calls were made and none stated a count. */
    readonly readCount: number | null
    /** The records its calls changed; null when calls were made and none stated a count. */
    readonly changedCount: number | null
    /** The calls whose adapter stated no count. */
    readonly uncounted: number
    /** How it ended. */
    readonly outcome: RunOutcome
}

/** The day the desk counts: the viewer's instant and the workspace's time zone, as the read's context carries them. */
export interface DeskDay {
    /** The IANA time zone of the workspace. */
    readonly timeZone: string
    /** Now. */
    readonly now: Date
}

/** `platform.agent-today`: what the agent did on the workspace's day. */
export interface AgentTodayView {
    /** The day, `YYYY-MM-DD` in the workspace's time zone. */
    readonly day: string
    /** The runs that finished done that day. */
    readonly answered: number
    /** The records read that day, or null when calls were made and none stated a count. */
    readonly recordsRead: number | null
    /** The records changed that day, or null when calls were made and none stated a count. */
    readonly recordsChanged: number | null
    /** The calls of the day whose adapter stated no count. */
    readonly uncounted: number
}

/** Where an attached account stands for the agent. */
export type ReachAccountState = "connected" | "attention" | "off"

/** One account the agent is attached to. */
export interface ReachAccount {
    /** The connected account. */
    readonly connectionId: string
    /** The name the owner gave it. */
    readonly name: string
    /** The provider's name in the viewer's language. */
    readonly providerName: string
    /** `connected`; `attention` when the connection does not work; `off` when the agent holds no ability on it. */
    readonly state: ReachAccountState
}

/** `platform.agent-reach`: the accounts the agent is attached to and the operations it may do on them, by mode. */
export interface AgentReachView {
    /** The accounts. */
    readonly accounts: ReadonlyArray<ReachAccount>
    /** The operations a running step does by itself. */
    readonly auto: ReadonlyArray<string>
    /** The operations a running step asks a person for first. */
    readonly ask: ReadonlyArray<string>
    /** The operations the attached accounts offer that no running step holds. */
    readonly none: ReadonlyArray<string>
}

/** The `platform.agent-desk` port, scoped to one asker; every read takes the installation whose agent it reads. */
export interface AgentDesk {
    /** The active workflows of the agent. */
    flows(installation: string): Promise<AgentFlowsView>
    /** The agent's runs stopped on a person. */
    waiting(installation: string): Promise<WaitingOnPersonFacts>
    /** A verdict on an approval of the agent waiting on a person, through the work engine's own decide door. */
    decide(installation: string, ask: ApprovalVerdictAsk): Promise<ApprovalDecideAnswer>
    /** The desk facts of runs of the agent (a page of `platform.agent-runs`); a run of another agent is left out. */
    runFacts(installation: string, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<AgentRunFacts>>
    /** What the agent did on the workspace's day. */
    today(installation: string, day: DeskDay): Promise<AgentTodayView>
    /** The accounts the agent is attached to and what it may do on them. */
    reach(installation: string): Promise<AgentReachView>
}
