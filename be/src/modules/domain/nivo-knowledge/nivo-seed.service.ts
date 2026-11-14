import { Injectable } from "@nestjs/common"
import { unwrapOutcome } from "@modules/platform/primitives"
import { NivoKnowledgeError, NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { NivoFolderClient } from "./nivo-folder.client"
import { nivoItemOf, type NivoFile } from "./nivo-item.policy"
import { InjectNivoKnowledgeOptions } from "./nivo-knowledge.decorators"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import type { MaybeFolder, NivoSeedResult } from "./nivo-knowledge.contracts"

@Injectable()
/** Publishes the base knowledge of NIVO from its shipped knowledge files; the vector index follows through the items' sync jobs. */
export class NivoSeedService {
    constructor(
        @InjectNivoKnowledgeOptions() private readonly options: NivoKnowledgeOptions,
        private readonly nivo: NivoKnowledgeService,
        private readonly folder: NivoFolderClient,
    ) {}

    /** Reads the base knowledge (the shipped one when no folder is named, else that folder on disk) and publishes what it holds. */
    async seedFolder(dir: MaybeFolder): Promise<NivoSeedResult> {
        return this.seedFiles(await this.folder.read(dir))
    }

    /**
     * Makes the table mirror the files: new items are inserted, existing ones are updated, items that are no longer given are removed,
     * each write with its `vector.sync` job (the job embeds a changed text, platform work not metered against any workspace, and drops
     * the point of a removed item; meanwhile the items are found by words). A file that cannot be read, or two files with one slug,
     * refuse the whole run before anything is written.
     */
    private async seedFiles(files: ReadonlyArray<NivoFile>): Promise<NivoSeedResult> {
        const slugs = new Set<string>()
        const items = files.map((file) => {
            const item = unwrapOutcome(nivoItemOf(file, this.options.folders), NivoKnowledgeError)
            if (slugs.has(item.slug)) {
                throw new NivoKnowledgeError({
                    code: NivoKnowledgeErrorCode.SlugDuplicate,
                    params: { file: file.path },
                })
            }
            slugs.add(item.slug)
            return item
        })
        const written = await this.nivo.upsert(items)
        const removed = await this.nivo.removeExcept(items.map((item) => item.slug))
        return {
            inserted: written.inserted,
            updated: written.updated,
            removed: removed.removed,
            queued: written.queued + removed.queued,
        }
    }
}
