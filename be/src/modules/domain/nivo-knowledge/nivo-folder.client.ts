import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import type { NivoFile } from "./nivo-item.policy"

@Injectable()
/** Reads the markdown files of a base knowledge folder from disk, sorted by path so a run is repeatable. */
export class NivoFolderClient {
    /** Every `.md` file under the folder, with its path relative to it (forward slashes). */
    async read(dir: string): Promise<ReadonlyArray<NivoFile>> {
        const found: Array<NivoFile> = []
        await this.walk(dir, "", found)
        return found.sort((a, b) => a.path.localeCompare(b.path))
    }

    /** Adds the markdown files of one folder, and of the folders below it, to `found`. */
    private async walk(root: string, relative: string, found: Array<NivoFile>): Promise<void> {
        const entries = await readdir(join(root, relative), { withFileTypes: true })
        await eachInOrder(entries, async (entry) => {
            const path = relative === "" ? entry.name : `${relative}/${entry.name}`
            if (entry.isDirectory()) {
                await this.walk(root, path, found)
                return
            }
            if (entry.name.endsWith(".md")) found.push({ path, text: await readFile(join(root, path), "utf8") })
        })
    }
}
