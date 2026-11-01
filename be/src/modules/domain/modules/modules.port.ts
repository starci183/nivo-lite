/** A capability that keeps records naming the installation they belong to: the port the record owners implement for the modules capability. */
export interface RecordInstallationSource {
    /** The installation the record of the workspace names, or null when the id is none of the owner's rows or the row names no installation. */
    installationIdOf(workspaceId: string, recordId: string): Promise<string | null>
}

/** A branch the owner confirmed in the setup chat, as the action graph of the installation is told. */
export interface SetupBranchChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation whose agent follows the graph. */
    readonly installationId: string
    /** The authority action whose bands the branch is about. */
    readonly action: string
    /** The amount in dong where the lower band ends and the higher one begins. */
    readonly boundaryVnd: number
    /** The band the exact boundary amount belongs to. */
    readonly belongsTo: "lower" | "higher"
    /** The seat asked above the line. */
    readonly approverMemberId: string
    /** The words of the owner, kept as the source of the branch. */
    readonly quote: string
    /** The chat message the words came from, or null. */
    readonly messageId: string | null
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
    /** Writes a confirmed branch into the draft of the graph of the installation. */
    applyBranch(change: SetupBranchChange): Promise<void>
    /** The code of the first vague place of the graph, or an empty text when it has none. */
    firstGap(workspaceId: string, installationId: string): Promise<string>
    /** The seat of a person the owner named, or an empty text when nobody is found. */
    seatNamed(workspaceId: string, name: string): Promise<string>
    /** Refuses before the setup writes anything when the publish would be refused; answers the newest graph version number, 0 with no graph. */
    checkPublish(applicant: SetupApplicant): Promise<number>
    /** Publishes the draft of the graph as the version the setup became, with its context version, even when the map did not change. */
    publish(applier: SetupApplier): Promise<void>
}
