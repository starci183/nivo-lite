import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isPrivateAddress } from "@modules/platform/primitives"
import {
    CHAT_FILE_BUCKET,
    CHAT_FILE_MAX_BYTES,
    chatFileExtensionOf,
    chatFileNameOf,
    chatFilePathOf,
    sniffChatFile,
    sniffUnsupportedImage,
} from "./chat-file.policy"
import type { ChatFileScope, DownloadedChatFile, InboundFileSource } from "./chat-files.contracts"
import {
    InjectChatFilesAssets,
    InjectChatFilesImportRoot,
    InjectChatFilesReader,
    InjectChatFilesResolver,
} from "./chat-files.decorators"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import {
    INBOUND_FILE_HEADERS,
    INBOUND_FILE_MAX_REDIRECTS,
    INBOUND_FILE_TIMEOUT_MS,
    importPathOf,
    inboundFileNameOf,
    isAcceptedDeclaredType,
    isFetchableFileUrl,
    isRedirectStatus,
    redirectTargetOf,
} from "./inbound-file.policy"
import type { InboundFileReader } from "./inbound-file.reader"
import type { HostResolver } from "./inbound-file.resolver"
import { AgentMessageAttachmentEntity } from "./persistence/entities"

/** What a read of one file found, for the log line of a file that is left out: never the address, only its host and how the answer looked. */
interface ReadTrace {
    /** The bytes, or null when none could be read. */
    readonly bytes: Uint8Array | null
    /** Why none were read, when none were. */
    readonly reason: "unreadable" | "blocked" | "not_found"
    /** The host of the last address asked. */
    readonly host: string
    /** The HTTP status of the last answer, or 0 when there was none. */
    readonly status: number
    /** The content type the last answer declared, or an empty text. */
    readonly contentType: string
    /** How many bytes the last answer held. */
    readonly length: number
    /** How many redirects were followed. */
    readonly hops: number
}

const NO_ANSWER: ReadTrace = {
    bytes: null,
    reason: "unreadable",
    host: "",
    status: 0,
    contentType: "",
    length: 0,
    hops: 0,
}

@Injectable()
/**
 * The files a channel brings in with a customer message. The bytes are read before the message is stored (a download is not done inside a database
 * transaction): from an https address, following at most three redirects with every hop checked again (https, a named host, and an address that is not
 * private) and asking as a browser asks for a picture, or, for a manual import only, from a file inside the import folder. The type comes from the
 * bytes, never from the address or the name; only an accepted type within the size limit is kept. A file that is left out is logged with the status, the
 * content type and the length of the answer, and the message still reaches its turn. A kept file is written to the private store of the conversation and
 * recorded on the message in the shape web-chat uploads use, with the address it came from.
 */
export class InboundFilesService {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectChatFilesAssets() private readonly assets: StorageAssetsPort,
        @InjectChatFilesImportRoot() private readonly importRoot: string,
        @InjectChatFilesReader() private readonly reader: InboundFileReader,
        @InjectChatFilesResolver() private readonly resolver: HostResolver,
        @InjectLogger() private readonly logger: Logger,
        private readonly entitlements: EntitlementsService,
    ) {}

    /**
     * Reads one file of the message `ref` (the `index`-th of it): null, with a log line, when it cannot be read, is too large or is not an accepted
     * type. A file with no name is named after the message and its real type. `imported` is true only for a manual import, the one source that may
     * name a local file. The preview is tried when the full file cannot be read.
     */
    async download(
        source: InboundFileSource,
        imported: boolean,
        ref: string,
        index = 0,
    ): Promise<DownloadedChatFile | null> {
        const full = await this.read(source.url, source.localPath, imported)
        const trace =
            full.bytes === null && source.thumbnailUrl !== ""
                ? await this.read(source.thumbnailUrl, "", imported)
                : full
        if (trace.bytes === null) return this.skip(trace.reason, source, trace)
        const contentType = sniffChatFile(trace.bytes)
        if (contentType === null) {
            const unsupported = sniffUnsupportedImage(trace.bytes) !== null
            return this.skip(unsupported ? "unsupported_type" : "unrecognized", source, trace)
        }
        const given = chatFileNameOf(source.name, "")
        return {
            bytes: trace.bytes,
            contentType,
            name: inboundFileNameOf(given, ref, index, chatFileExtensionOf(contentType)),
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

    private async read(url: string, localPath: string, imported: boolean): Promise<ReadTrace> {
        if (url !== "") return this.fetch(url, 0, NO_ANSWER)
        if (!imported || localPath === "") return NO_ANSWER
        const path = importPathOf(this.importRoot, localPath)
        const bytes = path === null ? null : await this.reader.read(path, CHAT_FILE_MAX_BYTES)
        return { ...NO_ANSWER, bytes, reason: "not_found", length: bytes?.length ?? 0 }
    }

    /** Asks for the address, and for each address a redirect leads to, after the same checks as the first: https, a named host, and no private answer from the name server. */
    private async fetch(url: string, hops: number, before: ReadTrace): Promise<ReadTrace> {
        const host = URL.canParse(url) ? new URL(url).hostname : ""
        const addresses = isFetchableFileUrl(url) ? await this.resolver.resolve(host) : []
        const [pin] = addresses
        if (pin === undefined || addresses.some((address) => isPrivateAddress(address.address))) {
            return { ...before, reason: "blocked", host, hops }
        }
        const answer = await this.http
            .request({
                method: "GET",
                url,
                headers: INBOUND_FILE_HEADERS,
                read: "bytes",
                redirect: "manual",
                pin,
                timeoutMs: INBOUND_FILE_TIMEOUT_MS,
            })
            .catch(() => null)
        if (answer === null) return { ...before, reason: "unreadable", host, hops, status: 0 }
        const contentType = answer.headers?.["content-type"] ?? ""
        const length = Buffer.isBuffer(answer.body) ? answer.body.length : 0
        const trace: ReadTrace = {
            bytes: null,
            reason: "unreadable",
            host,
            status: answer.status,
            contentType,
            length,
            hops,
        }
        if (isRedirectStatus(answer.status)) {
            const next = redirectTargetOf(answer.headers?.location, url)
            if (next === null || hops >= INBOUND_FILE_MAX_REDIRECTS) return trace
            return this.fetch(next, hops + 1, trace)
        }
        const usable = answer.status === 200 && Buffer.isBuffer(answer.body) && isAcceptedDeclaredType(contentType)
        return usable && length > 0 && length <= CHAT_FILE_MAX_BYTES
            ? { ...trace, bytes: answer.body as Buffer }
            : trace
    }

    private skip(reason: string, source: InboundFileSource, trace: ReadTrace): null {
        this.logger.warn(ChatFilesLogEvent.InboundSkipped, {
            reason,
            host: trace.host,
            status: trace.status,
            contentType: trace.contentType,
            length: trace.length,
            hops: trace.hops,
            local: source.localPath !== "",
        })
        return null
    }

    private skipKept(reason: string, file: DownloadedChatFile): false {
        this.logger.warn(ChatFilesLogEvent.InboundSkipped, {
            reason,
            contentType: file.contentType,
            length: file.bytes.length,
        })
        return false
    }
}
