import type { ConnectionsRegionView, ItemsRegionView, KnowledgeRegionView } from "../../views/views.types"

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

/** What the agent finished in the last days, as the region lists it. */
export interface DoneSummary {
    /** How many things the agent finished in all. */
    readonly total: number
    /** The newest ones, at most the limit asked. */
    readonly rows: ItemsRegionView["rows"]
}

/** The data the agent page asks of the platform about one agent. */
export interface AgentDone {
    /** What the agent finished lately: the count and the newest items. */
    readonly recent: (agentId: string, limit: number) => Promise<DoneSummary>
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
