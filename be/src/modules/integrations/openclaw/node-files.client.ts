import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { Injectable } from "@nestjs/common"
import type { OptionalText } from "./openclaw.contracts"
import type { OpenclawFiles } from "./openclaw-files.port"

@Injectable()
/** The OpenclawFiles port on the local disk. */
export class NodeFilesClient implements OpenclawFiles {
    /** The text of a file, or null when there is no such file. */
    readText(path: string): OptionalText {
        return existsSync(path) ? readFileSync(path, "utf8") : null
    }

    /** Writes a file through a temp file and a rename, creating its folders. */
    writeText(path: string, content: string, mode: number): void {
        mkdirSync(dirname(path), { recursive: true })
        const temp = `${path}.${process.pid}.tmp`
        writeFileSync(temp, content, { mode })
        renameSync(temp, path)
    }

    /** Removes a file; a missing file is fine. */
    remove(path: string): void {
        rmSync(path, { force: true })
    }

    /** True when the path exists. */
    exists(path: string): boolean {
        return existsSync(path)
    }

    /** The names inside a folder; empty when there is no such folder. */
    listNames(directory: string): ReadonlyArray<string> {
        return existsSync(directory) ? readdirSync(directory) : []
    }

    /** Removes a folder when it exists and is empty; answers true when it did. */
    removeDirectoryIfEmpty(directory: string): boolean {
        if (!existsSync(directory) || readdirSync(directory).length > 0) return false
        rmdirSync(directory)
        return true
    }
}
