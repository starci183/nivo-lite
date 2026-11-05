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
