import { Injectable } from "@nestjs/common"
import type { ProviderFile, ProviderFileSink } from "@modules/domain/provider-registry"
import { RecordFilesService } from "@modules/domain/record-files"
import { mediaRefusal } from "./media-refusal.policy"

@Injectable()
/**
 * The file store's sink of the generic media tools (`PROVIDER_FILE_SINK`): a provider's file (a speech clip, a generated video) is read
 * once from the provider and STAGED in the workspace by the records' one file store (`RecordFilesService.stage`, its own type and size
 * bounds), and the staged key is what the tool answers; a node then puts it into a record's field (`nivo.tool.file.put`, concept files).
 * A store that keeps no file of the type, of that size, or cannot be reached is the infrastructure refusal `file_store_unavailable`; a
 * failure to read the provider's bytes passes as the provider's own.
 */
export class RecordFileSinkService implements ProviderFileSink {
    constructor(private readonly files: RecordFilesService) {}

    /** Reads the provider's file and stores it as a record file of the workspace, answering the reference the files service gives it. */
    async store(workspaceId: string, file: ProviderFile): Promise<string> {
        const bytes = await file.fetch()
        try {
            // A view over the provider's buffer: the bytes are not copied a second time.
            const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            return await this.files.stage(workspaceId, view, file.mimeType ?? "")
        } catch (cause: unknown) {
            throw mediaRefusal("file_store_unavailable", cause)
        }
    }
}
