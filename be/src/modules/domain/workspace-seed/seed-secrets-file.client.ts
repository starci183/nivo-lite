import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { SeedSecretsStore } from "./workspace-seed.options"

const NOT_FOUND = "ENOENT"

/** The operator's secrets file on disk: `KEY=value` lines, created on first write with its folder. */
export class SeedSecretsFileClient implements SeedSecretsStore {
    constructor(readonly location: string) {}

    /** The file's text, or an empty text when the file does not exist yet. */
    async read(): Promise<string> {
        return readFile(this.location, "utf8").catch((cause: NodeJS.ErrnoException) => {
            if (cause.code === NOT_FOUND) return ""
            throw cause
        })
    }

    /** Replaces the file's text, creating its folder when needed. */
    async write(text: string): Promise<void> {
        await mkdir(dirname(this.location), { recursive: true })
        await writeFile(this.location, text, "utf8")
    }
}
