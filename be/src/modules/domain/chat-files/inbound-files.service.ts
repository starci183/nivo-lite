import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CHAT_FILE_BUCKET, CHAT_FILE_MAX_BYTES, chatFileNameOf, chatFilePathOf, sniffChatFile } from "./chat-file.policy"
import type { ChatFileScope, DownloadedChatFile, InboundFileSource } from "./chat-files.contracts"
import { InjectChatFilesAssets, InjectChatFilesImportRoot, InjectChatFilesReader } from "./chat-files.decorators"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import { INBOUND_FILE_TIMEOUT_MS, importPathOf, isAcceptedDeclaredType, isFetchableFileUrl } from "./inbound-file.policy"
import type { InboundFileReader } from "./inbound-file.reader"
import { AgentMessageAttachmentEntity } from "./persistence/entities"

@Injectable()
/**
 * The files a channel brings in with a customer message. The bytes are read before the message is stored (a download is not done inside a database
 * transaction): from an https address with a deadline, or, for a manual import only, from a file inside the import folder. Only what the bytes prove to
 * be an accepted type within the size limit is kept; the rest is left out and logged, and the message still reaches its turn. A kept file is written to
 * the private store of the conversation and recorded on the message in the shape web-chat uploads use, with the address it came from.
 */
export class InboundFilesService {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectChatFilesAssets() private readonly assets: StorageAssetsPort,
        @InjectChatFilesImportRoot() private readonly importRoot: string,
        @InjectChatFilesReader() private readonly reader: InboundFileReader,
        @InjectLogger() private readonly logger: Logger,
        private readonly entitlements: EntitlementsService,
    ) {}

    /** Reads one file: null, with a log line, when it cannot be read, is too large or is not an accepted type. `imported` is true only for a manual import, the one source that may name a local file. */
    async download(source: InboundFileSource, imported: boolean): Promise<DownloadedChatFile | null> {
        const bytes = await this.bytesOf(source, imported)
        const contentType = bytes === null ? null : sniffChatFile(bytes)
        if (bytes === null || contentType === null) return this.skip("unreadable", source)
        return {
            bytes,
            contentType,
            name: chatFileNameOf(source.name, source.url === "" ? source.localPath : source.url),
            sourceUrl: source.url === "" ? source.localPath : source.url,
        }
    }

    /**
     * Writes a read file to the store of the conversation and records it on the message in the caller's transaction. `ref` is the channel's own id
     * of the message. Answers false, with a log line, when the plan has no room or the store refuses: the message stands without the file.
     */
    async keep(
        scope: ChatFileScope,
        file: DownloadedChatFile,
        ref: string,
        messageId: string,
        manager: EntityManager,
    ): Promise<boolean> {
        const room = await this.entitlements.requireStorageFor(scope.workspaceId, file.bytes.length).then(
            () => true,
            () => false,
        )
        if (!room) return this.skipKept("plan", file)
        const path = chatFilePathOf(scope, randomUUID(), file.contentType)
        const written = await this.assets.upload(CHAT_FILE_BUCKET, path, Buffer.from(file.bytes), file.contentType)
        if (written.error !== null) return this.skipKept("store", file)
        await manager.insert(AgentMessageAttachmentEntity, {
            workspaceId: scope.workspaceId,
            conversationId: scope.conversationId,
            messageId,
            path,
            name: file.name,
            contentType: file.contentType,
            sizeBytes: file.bytes.length,
            sourceUrl: file.sourceUrl,
            sourceRef: ref,
        })
        return true
    }

    private async bytesOf(source: InboundFileSource, imported: boolean): Promise<Uint8Array | null> {
        if (source.url !== "") return this.fetch(source.url)
        if (!imported || source.localPath === "") return null
        const path = importPathOf(this.importRoot, source.localPath)
        return path === null ? null : this.reader.read(path, CHAT_FILE_MAX_BYTES)
    }

    private async fetch(url: string): Promise<Uint8Array | null> {
        if (!isFetchableFileUrl(url)) return null
        const answer = await this.http
            .request({ method: "GET", url, read: "bytes", redirect: "manual", timeoutMs: INBOUND_FILE_TIMEOUT_MS })
            .catch(() => null)
        if (answer === null || answer.status !== 200 || !Buffer.isBuffer(answer.body)) return null
        if (!isAcceptedDeclaredType(answer.headers?.["content-type"])) return null
        return answer.body.length > 0 && answer.body.length <= CHAT_FILE_MAX_BYTES ? answer.body : null
    }

    private skip(reason: string, source: InboundFileSource): null {
        this.logger.warn(ChatFilesLogEvent.InboundSkipped, {
            reason,
            host: URL.canParse(source.url) ? new URL(source.url).hostname : "",
            local: source.localPath !== "",
        })
        return null
    }

    private skipKept(reason: string, file: DownloadedChatFile): false {
        this.logger.warn(ChatFilesLogEvent.InboundSkipped, { reason, contentType: file.contentType, sizeBytes: file.bytes.length })
        return false
    }
}
