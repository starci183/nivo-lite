import type { ConnectionsRegionView, KnowledgeRegionView } from "../../views/views.types"

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
    /** The kind of the record the run is about, for instance `sales.order`. */
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
