import type { ConnectionsRegionView, KnowledgeRegionView } from "./regions.types"

/** What the installed registry holds of one module, as the back end reads it from the module declarations. */
export interface InstalledModuleFacts {
    /** The module key. */
    readonly key: string
    /** The permissions the module declares. */
    readonly permissions: ReadonlyArray<string>
    /** The ids of the reads the module declares. */
    readonly reads: ReadonlyArray<string>
    /** The ids of the actions the module declares. */
    readonly actions: ReadonlyArray<string>
    /** The ids of the views of the module's seed specs, in spec order. */
    readonly views: ReadonlyArray<string>
}

/** What the back end knows of the installation: the registry it runs, and which of its modules the workspace has enabled. */
export interface InstallationFacts {
    /** The hash of the registry the back end runs; the front end compares it with its own build. */
    readonly registryHash: string
    /** Every module of the registry, in registry order. */
    readonly modules: ReadonlyArray<InstalledModuleFacts>
    /** The keys of the modules the workspace has enabled. */
    readonly enabled: ReadonlyArray<string>
}

/** The installation as the platform serves it to a screen. */
export interface InstallationView {
    /** The hash of the registry the back end runs. */
    readonly registryHash: string
    /** Every module of the registry, in registry order. */
    readonly modules: ReadonlyArray<InstalledModuleView>
}

/** One module of the installation. */
export interface InstalledModuleView extends InstalledModuleFacts {
    /** Whether the workspace has the module enabled. */
    readonly enabled: boolean
}

/** What the platform asks of the back end to describe the installation. */
export interface InstallationSource {
    /** The registry and the workspace's enabled modules, as they are now. */
    readonly current: () => Promise<InstallationFacts>
}

/** What a module asks of a seat of the workspace: the name it is shown under and whether it may act on what others hold. */
export interface MemberFacts {
    /** The name the member is shown under. */
    readonly displayName: string
    /** Whether the member is an owner or a manager. */
    readonly isManager: boolean
}

/** The seats of the workspace, as far as a module's actions care. */
export interface MemberDirectory {
    /** The active member by seat id; null when the workspace has none. */
    readonly get: (memberId: string) => Promise<MemberFacts | null>
}

/** What a module asks of the rights of the member who acts. */
export interface RightsDirectory {
    /** Whether the member holds the permission of the workspace; an actor that is no member (the agent) holds none. */
    readonly holds: (memberId: string | null, permission: string) => Promise<boolean>
}

/** The connections bound to one agent. */
export interface AgentConnections {
    /** The connections region of the agent, with the words of the viewer's workspace. */
    readonly of: (agentId: string) => Promise<ConnectionsRegionView>
}

/** What one agent knows. */
export interface AgentKnowledge {
    /** The knowledge region of the agent, with its open gaps. */
    readonly of: (agentId: string) => Promise<KnowledgeRegionView>
}

/** One run the engine parked: it stopped at a step and waits for a person or a build to resume it. */
export interface ParkedRunRow {
    /** The run id. */
    readonly id: string
    /** The module the run works for (the key before the dot of its subject kind). */
    readonly module: string
    /** The kind of the record the run is about, for instance `blocks-core.sales.order`. */
    readonly subjectKind: string
    /** The id of the record the run is about. */
    readonly subjectId: string
    /** The step the run stopped at. */
    readonly step: string
    /** The code of the error that parked it. */
    readonly errorCode: string
    /** What the error says, in words a person reads. */
    readonly errorWords: string
    /** When it was parked, ISO text. */
    readonly parkedAt: string
}

/** What `platform.parked-runs` answers. */
export interface ParkedRunsView {
    /** How many parked runs match, as text; null when none. */
    readonly count: string | null
    /** The newest ones, at most the limit. */
    readonly rows: ReadonlyArray<ParkedRunRow>
}

/** Which parked runs a read asks for; every field narrows, none given lists all of the workspace. */
export interface ParkedRunFilter {
    /** Only the runs of this module. */
    readonly module?: string | undefined
    /** Only the runs about records of this kind. */
    readonly subjectKind?: string | undefined
    /** Only the runs about this record. */
    readonly subjectId?: string | undefined
}

/** What the back end knows of one run a person asks to resume. */
export interface RunStanding {
    /** The module the run works for. */
    readonly module: string
    /** Whether the run is parked now; false when it runs, waits or ended. */
    readonly parked: boolean
}

/** The runs the engine parked, and the one door that resumes them: the engine owns retry and resume, a module only asks. */
export interface ParkedRuns {
    /** The newest parked runs matching the filter, at most the limit, with how many match in all. */
    readonly list: (
        filter: ParkedRunFilter,
        limit: number,
    ) => Promise<{ readonly total: number; readonly rows: ReadonlyArray<ParkedRunRow> }>
    /** The standing of one run; null when the workspace has no such run. */
    readonly find: (runId: string) => Promise<RunStanding | null>
    /** Resumes a parked run; false when it was no longer parked by the time the engine looked. */
    readonly resume: (runId: string) => Promise<boolean>
}

/** One run of an agent, as the core read of the runs hands it to a read of a module. */
export interface CoreRun {
    /** The run id, which `platform.resume-run` takes. */
    readonly id: string
    /** The agent. */
    readonly agentId: string
    /** What woke the agent, as the engine keeps it. */
    readonly trigger: string
    /** The engine status. */
    readonly status: string
    /** When it started (ISO text). */
    readonly startedAt: string
    /** When it ended or parked (ISO text), or null. */
    readonly endedAt: string | null
    /** Why it parked, or null. */
    readonly parkReason: string | null
    /** The work item it waits on, or null. */
    readonly waitWorkItemId: string | null
}

/** One step of a run, as the core read of the runs hands it to a read of a module. */
export interface CoreRunStep {
    /** The step id. */
    readonly id: string
    /** Unique within the run. */
    readonly stepKey: string
    /** The node of the graph. */
    readonly nodeKey: string
    /** The engine status. */
    readonly status: string
    /** What it was given. */
    readonly input: Readonly<Record<string, unknown>>
    /** What it produced, or null. */
    readonly result: Readonly<Record<string, unknown>> | null
    /** When its try began (ISO text), or null. */
    readonly startedAt: string | null
    /** How long it took, milliseconds, or null. */
    readonly durationMs: number | null
    /** The door calls it made, `{ calls: [...] }`. */
    readonly doorCalls: Readonly<Record<string, unknown>>
    /** The effect key it was sent under, or null. */
    readonly effectKey: string | null
    /** Why it last failed, or null. */
    readonly errorCode: string | null
    /** The work item it waits on, or null. */
    readonly waitItemId: string | null
}

/** Which runs of an agent one page lists: newest start (`started`) or newest end (`ended`) first, narrowed to statuses when named. */
export interface CoreRunsQuery {
    /** The agent. */
    readonly agent: string
    /** The engine statuses kept; every status when absent. */
    readonly statuses?: ReadonlyArray<string>
    /** The order. */
    readonly order: "started" | "ended"
    /** The most runs of the page. */
    readonly size: number
    /** The cursor of the page, from the one before. */
    readonly after?: string
}

/** One page of runs and the cursor of the next; null on the last. */
export interface CoreRunsPage {
    /** The runs. */
    readonly rows: ReadonlyArray<CoreRun>
    /** The cursor of the next page; null on the last. */
    readonly next: string | null
}

/** How many runs of an agent stand in one engine status. */
export interface CoreRunCount {
    /** The status. */
    readonly status: string
    /** How many. */
    readonly count: number
}

/** The runs of the agents, read from the core tables of the engine (no module holds them). */
export interface CoreRunsRead {
    /** One page of the runs of an agent. */
    list(query: CoreRunsQuery): Promise<CoreRunsPage>
    /** One run of the workspace, or null. */
    get(runId: string): Promise<CoreRun | null>
    /** The steps of a run in order, at most `limit`. */
    steps(runId: string, limit: number): Promise<ReadonlyArray<CoreRunStep>>
    /** How many runs of an agent stand in each status (of the statuses named, or every one). */
    count(agent: string, statuses?: ReadonlyArray<string>): Promise<ReadonlyArray<CoreRunCount>>
}

/**
 * The `platform.core` port: what a read of a module reads of the core of the engine, scoped to the workspace of the read (the read's own
 * permission gates it). The door provides it from the engine's run and graph services.
 */
export interface CoreReads {
    /** The agent an installation of the workspace runs (from the graph that holds the installation), or null. */
    agentOf(installation: string): Promise<string | null>
    /** The runs of the agents. */
    readonly runs: CoreRunsRead
}

/** Where a line the shop said to a customer stands: claimed before the provider is asked, then delivered, refused or of unknown outcome. */
export type CustomerLineState = "claimed" | "delivered" | "refused" | "unknown"

/** Who holds a customer's route (a staff member took the thread over, ruling R43), and since when. */
export interface RouteHoldView {
    /** The member who holds it. */
    readonly memberId: string
    /** When they took it, ISO text. */
    readonly at: string
}

/** What handing a held route back to the agent came to, and how many lines held meanwhile were answered by the resume. */
export interface RouteHandBack {
    /** `released` (the hold cleared, one resume event delivered), `nothing_held`, or `not_found` (no such route). */
    readonly outcome: "released" | "nothing_held" | "not_found"
    /** How many held lines the resume answered. */
    readonly answered: number
}

/**
 * The `platform.route-holds` port: the staff hold on a customer's route is ENGINE data (ruling R43; the send door refuses every AI send to a
 * held route with `route_held`, a member's typed reply goes). The door scopes it to the workspace of the run and acts as the run's MEMBER
 * (a run with no member is refused with a typed error).
 */
/** One route a member of the shop holds now, with the hold. */
export interface HeldRouteView extends RouteHoldView {
    /** The route held. */
    readonly routeId: string
}

/** The routes held now in the workspace: a page, the latest hold first, and how many are held in all. */
export interface HeldRoutes {
    /** How many routes are held in all. */
    readonly count: number
    /** The held routes, the latest hold first (at most the limit asked). */
    readonly routes: ReadonlyArray<HeldRouteView>
}

/** The holds on a customer route: who has taken it over from the agent, and the acts that take, hand back or read a hold. */
export interface RouteHolds {
    /** The run's member takes the route over. */
    take(routeId: string): Promise<"held" | "not_found">
    /** Who holds the route, or null. */
    holderOf(routeId: string): Promise<RouteHoldView | null>
    /** Hands the route back to the agent: the hold clears, then ONE resume event is delivered (the release door's act). */
    handBack(routeId: string): Promise<RouteHandBack>
    /** The routes a member of the shop holds now in the workspace, the latest hold first, at most `limit` (1..100), with how many are held in all. */
    held(limit: number): Promise<HeldRoutes>
}

/** Who a line of the conversation with a customer is from: the person, or the shop (any agent, the engine's own line, a member's typed reply). */
export type CustomerLineDirection = "from_person" | "to_person"

/** One file of a line, by address. */
export interface CustomerLineFile {
    /** Where the file is served from. */
    readonly url: string
    /** The name of the file, or empty. */
    readonly name: string
    /** The media type, or empty when the sender did not say. */
    readonly contentType: string
    /** The caption a sent picture carried, when it had one. */
    readonly caption?: string | undefined
}

/** One line of the conversation with a customer, as the engine keeps it (both directions, every agent's, per route). */
export interface CustomerLine {
    /** The line id: the reference a module keeps when it needs one. */
    readonly id: string
    /** The route it was said on (the engine's opaque id of one person on one entrance). */
    readonly routeId: string
    /** The person, as their id was when it was said. */
    readonly contactId: string
    /** Who it is from. */
    readonly direction: CustomerLineDirection
    /** When it was said, ISO text: the order of the thread. */
    readonly saidAt: string
    /** The words (empty for a line of files only). */
    readonly text: string
    /** The files, by address. */
    readonly files: ReadonlyArray<CustomerLineFile>
    /** The order snapshot a sent line showed, or null. */
    readonly order: Readonly<Record<string, unknown>> | null
    /** The agent that told a sent line, or null. */
    readonly agentId: string | null
    /** The member of the shop who typed a sent line, or null. */
    readonly memberId: string | null
    /** Where a sent line stands; null for a line the person said. */
    readonly state: CustomerLineState | null
    /** Why a sent line was refused, or what is known of an unknown outcome; null otherwise. */
    readonly reason: string | null
    /** The channel it was said on. */
    readonly channel: string
    /** The connection, site or API key of the entrance, or null. */
    readonly accountId: string | null
    /** When the provider took a sent line, ISO text, or null. */
    readonly deliveredAt: string | null
}

/** How many lines `platform.customer-messages` is asked for, from when, and where it starts. */
export interface CustomerMessagesAsk {
    /** The most lines: at most 100, default 50. */
    readonly limit?: number | undefined
    /** The `next` of the page before; absent starts from the newest. */
    readonly after?: string | null | undefined
    /** ISO text: only lines said from then on; absent: the whole route (or person). */
    readonly since?: string | null | undefined
}

/** One page of lines, newest first. */
export interface CustomerMessagesPage {
    /** The lines. */
    readonly lines: ReadonlyArray<CustomerLine>
    /** The cursor of the next page, or null at the end. */
    readonly next: string | null
}

/**
 * The `platform.customer-messages` port: the conversation with the customers, both directions, every agent's lines and the members'
 * typed replies, read-only and bounded. The door scopes it to the workspace of the read or the service call; it does NOT narrow by the
 * asking agent (the conversation is the person's, not one agent's). A person merged into another is read under the survivor.
 */
export interface CustomerMessages {
    /** The lines of one route, newest first. */
    byRoute(routeId: string, ask?: CustomerMessagesAsk): Promise<CustomerMessagesPage>
    /** The lines of one person (on every route of them), newest first. */
    byContact(contactId: string, ask?: CustomerMessagesAsk): Promise<CustomerMessagesPage>
}
