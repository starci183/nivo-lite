import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import type { MaybeFolder } from "./nivo-knowledge.contracts"
import type { NivoFile } from "./nivo-item.policy"
import { NIVO_KNOWLEDGE_FILES } from "./nivo-knowledge.templates"

/** Orders files by path so a run is repeatable. */
const byPath = (files: ReadonlyArray<NivoFile>): ReadonlyArray<NivoFile> =>
    [...files].sort((a, b) => a.path.localeCompare(b.path))

@Injectable()
/** Gives the markdown files of the base knowledge: the ones NIVO ships, or those of a folder on disk an operator names, sorted by path. */
export class NivoFolderClient {
    /** The shipped base knowledge when no folder is named; otherwise every `.md` file under the folder, with its path relative to it (forward slashes). */
    async read(dir: MaybeFolder): Promise<ReadonlyArray<NivoFile>> {
        if (dir === undefined) return byPath(NIVO_KNOWLEDGE_FILES)
        const found: Array<NivoFile> = []
        await this.walk(dir, "", found)
        return byPath(found)
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
