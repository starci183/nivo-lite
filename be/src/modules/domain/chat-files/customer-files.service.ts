import { Injectable, Optional } from "@nestjs/common"
import type { LineFile } from "@nivo-lite/agent-sdk/customer-send"
import type { StorageAssetsPort, StorageObjectsPort } from "@modules/integrations/object-storage"
import { InjectRemoteFiles, type RemoteFiles } from "@modules/integrations/remote-files"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CHAT_FILE_BUCKET, CHAT_FILE_MAX_BYTES, chatFileNameOf, sniffChatFile } from "./chat-file.policy"
import type { CustomerAttachment, OptionalCustomerFileBytes } from "./chat-files.contracts"
import { InjectChatFilesAssets, InjectChatFilesStorage } from "./chat-files.decorators"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import {
    CUSTOMER_FILE_REF,
    CUSTOMER_FILES_MAX,
    customerFilePathOf,
    customerObjectPathOf,
    isCustomerFilePath,
    unreadFileOf,
} from "./customer-files.policy"

/** How long one file may take to come from the channel, milliseconds. */
const FETCH_TIMEOUT_MS = 15_000

/** The media type of a `content-type` value, without its parameters. */
const mediaTypeOf = (declared: string): string => declared.split(";", 1).join("").trim().toLowerCase()

/** A declared type worth reading: a picture or a PDF (the bytes decide what is kept). */
const isWanted = (declared: string): boolean => {
    const type = mediaTypeOf(declared)
    return type.startsWith("image/") || type === "application/pdf" || type === "application/octet-stream" || type === ""
}

@Injectable()
/**
 * The pictures and files a customer sends on a channel (D-MX-4): read ONCE from the channel's address, through the lane's guarded
 * fetch (size and time limits, a type check on the header and on the bytes), and kept in the shop's private store under a path the
 * message decides, so the line keeps an address that never expires (`chat-file:<path>`) and the same message heard again writes the
 * same object. A file that cannot be kept is still on the line, without an address: a step is told a picture came that nobody saw.
 */
export class CustomerFilesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectRemoteFiles() private readonly remote: RemoteFiles,
        @InjectChatFilesStorage() private readonly storage: StorageObjectsPort,
        @Optional() @InjectChatFilesAssets() private readonly assets?: StorageAssetsPort,
    ) {}

    /** The files of one customer message as its line keeps them, in the order sent; at most `CUSTOMER_FILES_MAX`. */
    keep(
        workspaceId: string,
        channelEventId: string,
        attachments: ReadonlyArray<CustomerAttachment>,
    ): Promise<ReadonlyArray<LineFile>> {
        return Promise.all(
            attachments
                .slice(0, CUSTOMER_FILES_MAX)
                .map((attachment, index) => this.keptOne(workspaceId, channelEventId, index, attachment)),
        )
    }

    /** The bytes of a kept customer file of this workspace, or null when the address is not the shop's or the store lost it. */
    async bytesOf(workspaceId: string, url: string): Promise<OptionalCustomerFileBytes> {
        const path = customerFilePathOf(url)
        if (path === null || !isCustomerFilePath(workspaceId, path)) return null
        const stored = await this.storage.download(CHAT_FILE_BUCKET, path)
        if (stored.kind !== "ok") return null
        const contentType = sniffChatFile(stored.value.bytes)
        return contentType === null ? null : { contentType, bytes: stored.value.bytes }
    }

    private async keptOne(
        workspaceId: string,
        channelEventId: string,
        index: number,
        attachment: CustomerAttachment,
    ): Promise<LineFile> {
        const unread = unreadFileOf(index, attachment.kind, attachment.name)
        if (attachment.url === "" || this.assets === undefined) return this.notKept(unread, "no_address")
        try {
            const answer = await this.remote.read({
                url: attachment.url,
                maxBytes: CHAT_FILE_MAX_BYTES,
                timeoutMs: FETCH_TIMEOUT_MS,
                accepts: isWanted,
            })
            const bytes = answer.bytes
            const contentType = bytes === null ? null : sniffChatFile(bytes)
            if (bytes === null || contentType === null) return this.notKept(unread, `refused_${String(answer.status)}`)
            const path = customerObjectPathOf(workspaceId, channelEventId, index, contentType)
            const written = await this.assets.upload(CHAT_FILE_BUCKET, path, bytes, contentType)
            if (written.error !== null) return this.notKept(unread, "store_failed")
            return { id: path, url: `${CUSTOMER_FILE_REF}${path}`, name: chatFileNameOf(attachment.name, path), contentType }
        } catch (cause) {
            return this.notKept(unread, cause instanceof Error ? cause.name : "unreadable")
        }
    }

    private notKept(unread: LineFile, reason: string): LineFile {
        this.logger.warn(ChatFilesLogEvent.CustomerFileNotKept, { reason, contentType: unread.contentType })
        return unread
    }
}
