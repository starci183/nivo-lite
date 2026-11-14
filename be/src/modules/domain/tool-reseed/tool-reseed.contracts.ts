import type { PlannedReseed, ReseedStore, StoreCount } from "./tool-reseed.policy"

/** Where a re-seed prints. */
export interface ReseedOutput {
    /** Writes one chunk of text. */
    write(text: string): unknown
}

/** What one re-seed run is asked. */
export interface ReseedRequest {
    /** Only this workspace; every workspace when absent. */
    readonly workspaceId?: string | undefined
    /** True writes; anything else only prints what `--execute` would do. */
    readonly execute?: boolean | undefined
    /** The parsed JSON of the rename map file, and its path for the report. */
    readonly map: ReseedMap
}

/** The rename map file as read: its parsed JSON and its path. */
export interface ReseedMap {
    /** The parsed JSON of the file. */
    readonly json: unknown
    /** The path of the file, for the report. */
    readonly path: string
}

/** Why a run wrote nothing at all. */
export type ReseedRefusal = "bad_map" | "not_drained"

/** One agent whose re-seed failed (the others were still done). */
export interface ReseedFailure {
    /** The agent. */
    readonly agentId: string
    /** The error's code, or `failed`. */
    readonly code: string
}

/** What a run found and did in one workspace. */
export interface WorkspaceReseed {
    /** The workspace. */
    readonly workspaceId: string
    /** The counts per store. */
    readonly counts: Readonly<Record<ReseedStore, StoreCount>>
    /** The drain counts the verb read (entity-engine records), by condition. */
    readonly drain: Readonly<Record<string, number>>
    /** The plan of every workflow of every agent. */
    readonly plans: ReadonlyArray<PlannedReseed>
    /** The lines naming what was left and why (orphans of the rekey, workflows left with old ids). */
    readonly notes: ReadonlyArray<string>
    /** The agents whose re-seed failed. */
    readonly failed: ReadonlyArray<ReseedFailure>
}

/** What a re-seed run found and did, over every workspace it read. */
export interface ReseedReport {
    /** True when the run wrote. */
    readonly executed: boolean
    /** Why nothing was written; null for a run that went on. */
    readonly refusal: ReseedRefusal | null
    /** The map path. */
    readonly mapPath: string
    /** Per workspace. */
    readonly workspaces: ReadonlyArray<WorkspaceReseed>
    /** The counts per store over every workspace. */
    readonly totals: Readonly<Record<ReseedStore, StoreCount>>
    /** How many agents failed. */
    readonly failed: number
}

/** What `cli tools reseed` reads from its flags. */
export interface ReseedCommandOptions {
    /** Only this workspace. */
    readonly workspace?: string
    /** The map file. */
    readonly map?: string
    /** True only prints (the default). */
    readonly dryRun?: boolean
    /** True writes. */
    readonly execute?: boolean
}

/** What the command sets its exit code on (the `process`). */
export interface ReseedExit {
    /** The exit code the process ends with. */
    exitCode?: number | string | null | undefined
}

/** How the command reads the map file (`readFile`). */
export type ReseedTextReader = (path: string, encoding: "utf8") => Promise<string>
