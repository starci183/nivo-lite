/** One workflow file of the shared n8n templates; the fields n8n reads travel untouched. */
export interface N8nWorkflowFile {
    /** The name n8n lists the workflow under: the key of the upsert. */
    readonly name: string
    /** The nodes of the workflow. */
    readonly nodes: ReadonlyArray<object>
    /** Everything else the file carries. */
    readonly [field: string]: unknown
}

/** What the sync changes on the host. */
export type N8nSyncAction = "create" | "update" | "active" | "restart"

/** One line of the plan or of the report. */
export interface N8nSyncStep {
    /** What happens to the workflow. */
    readonly action: N8nSyncAction
    /** The workflow name; empty for the restart. */
    readonly name: string
    /** The id n8n gave the workflow; empty when it has none yet. */
    readonly id: string
}

/** How one sync run behaves. */
export interface N8nSyncOptions {
    /** Show the plan and change nothing. */
    readonly dryRun: boolean
    /** Restart n8n after the import so it registers the production webhooks. */
    readonly restart: boolean
    /** Talk to a docker container on this machine instead of the VPS. */
    readonly local: boolean
}

/** One command for the shell of the host. */
export interface HostCommand {
    /** The command line. */
    readonly command: string
    /** Standard input for the command; empty for none. */
    readonly input: string
    /** True to run it on this machine instead of the VPS. */
    readonly local: boolean
}

/** The n8n host: runs one command there and answers its output, and holds the workflow files to put there. */
export interface N8nHostShell {
    /** Runs the command; answers its output and throws when it fails. */
    run(request: HostCommand): Promise<string>
    /** The workflow files: the json files of the `n8n-templates` folder that are not meta files, in file-name order. */
    workflows(): Promise<ReadonlyArray<unknown>>
}

/** The sync of the shared workflows into the n8n container. */
export interface N8nHost {
    /** Imports the workflows of the resources folder, activates them and restarts n8n; answers the steps taken, or planned under a dry run. */
    sync(options: N8nSyncOptions): Promise<ReadonlyArray<N8nSyncStep>>
}
