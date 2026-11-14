/** A capability that keeps records naming the installation they belong to: the port the record owners implement for the modules capability. */
export interface RecordInstallationSource {
    /** The installation the record of the workspace names, or null when the id is none of the owner's rows or the row names no installation. */
    installationIdOf(workspaceId: string, recordId: string): Promise<string | null>
}

/** Who applies a setup to which installation, for the graph to check the publish under the right of the seat. */
export interface SetupApplicant {
    /** The workspace. */
    readonly workspaceId: string
    /** The account applying. */
    readonly principalId: string
    /** The installation applied. */
    readonly installationId: string
}

/** Who applies a setup, for the graph to publish under the right of the seat. */
export interface SetupApplier extends SetupApplicant {
    /** The number both the context version and the graph version take. */
    readonly version: number
    /** The context version the setup became. */
    readonly contextVersionId: string
}

/** The action graph of an installation, seen from the setup chat; absent in an app with no graph, and then the setup runs as it always did. */
export interface SetupGraphPort {
    /** Refuses before the setup writes anything when the publish would be refused; answers the newest graph version number, 0 with no graph. */
    checkPublish(applicant: SetupApplicant): Promise<number>
    /** Publishes the draft of the graph as the version the setup became, with its context version, even when the map did not change. */
    publish(applier: SetupApplier): Promise<void>
    /** Proposes the contracts and gaps the Second Brain and the setup text call for, for the owner to approve; answers how many were new. */
    proposeContracts(applier: SetupApplier): Promise<number>
}
