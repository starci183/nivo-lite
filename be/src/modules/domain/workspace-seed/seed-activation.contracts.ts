import type { InstallationRecord, InstallationStatus } from "@modules/domain/module-installations"

/** The answer of one gate of a module's setup checklist, confirmed in the setup chat as the owner's own wording. */
export interface SeedSetupAnswer {
    /** The gate key of the module definition. */
    readonly gate: string
    /** The business answer. */
    readonly evidence: string
}

/** The workspace a seed is applied to and the owner who writes it. */
export interface SeedTarget {
    /** The workspace. */
    readonly workspaceId: string
    /** The authenticated owner. */
    readonly ownerId: string
}

/** One installation a seed run kept, with the answers of its module's gates. */
export interface SeedInstallation {
    /** The agent handle the status is reported by. */
    readonly handle: string
    /** The installation that drives the agent. */
    readonly installation: InstallationRecord
    /** The answers of its module's gates. */
    readonly answers: ReadonlyArray<SeedSetupAnswer>
}

/** The status each installation of a run settled in, by agent handle. */
export type SeedStatuses = Readonly<Record<string, InstallationStatus>>
