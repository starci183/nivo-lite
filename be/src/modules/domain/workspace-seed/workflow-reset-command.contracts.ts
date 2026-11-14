/** What `reset-workflows` is asked to do, as the command line parsed it. */
export interface ResetWorkflowsCommand {
    /** The name of the workspace whose agents' workflows are reset. */
    readonly workspace: string
    /** The folder of the seeded graph files, one JSON graph spec per module. */
    readonly graphs: string
    /** True counts what the reset would clear, per kind, and changes nothing. */
    readonly dryRun?: boolean | undefined
}

/** How the command reads the graph folder (`readdir` and `readFile` of the file system). */
export interface GraphFolderReader {
    /** The names in a folder. */
    readdir(folder: string): Promise<Array<string>>
    /** The text of a file. */
    readFile(path: string, encoding: "utf8"): Promise<string>
}
