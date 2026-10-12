import type { OptionalText } from "./openclaw.contracts"

/** The file system the agent workspaces and openclaw.json live on: the one door of this integration to a disk. */
export interface OpenclawFiles {
    /** The text of a file, or null when there is no such file. */
    readText(path: string): OptionalText
    /** Writes a file through a temp file and a rename, creating its folders, so a reader never sees a half-written file. */
    writeText(path: string, content: string, mode: number): void
    /** Removes a file; a missing file is fine. */
    remove(path: string): void
    /** True when the path exists. */
    exists(path: string): boolean
    /** The names inside a folder; empty when there is no such folder. */
    listNames(directory: string): ReadonlyArray<string>
    /** Removes a folder when it exists and is empty; answers true when it did. */
    removeDirectoryIfEmpty(directory: string): boolean
}
