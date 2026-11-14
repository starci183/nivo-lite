import { Injectable, Optional } from "@nestjs/common"
import type { StorageAssetsPort, StorageObjectsPort } from "@modules/integrations/object-storage"
import { InjectRemoteFiles, type RemoteFiles } from "@modules/integrations/remote-files"
import { RemoteFilesError, RemoteFilesErrorCode } from "@modules/integrations/remote-files/errors/remote-files.error"
import { InjectErrorReporter, isDomainError, type ErrorReporter } from "@modules/platform/errors"
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
    type CustomerFile,
    type FileNotKept,
} from "./customer-files.policy"

/** The scope an attachment an intake could not keep is reported under (the app errors, /admin/health). */
const NOT_KEPT_SCOPE = "chat_files.customer_file_not_kept"

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
 * same object. A file that cannot be kept is a TYPED, REPORTED outcome (DEF-7): it stays on the event's stored line without an address,
 * its id naming why (`unread:<reason>:<index>`, `FileNotKept`), one app error is recorded per file (the event, the index, the reason, the
 * cause), and a model call is told it was not seen (`picturesNotSeen`): never an address that is not there, never a silent warning.
 */
export class CustomerFilesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectRemoteFiles() private readonly remote: RemoteFiles,
        @InjectChatFilesStorage() private readonly storage: StorageObjectsPort,
        @Optional() @InjectChatFilesAssets() private readonly assets?: StorageAssetsPort,
        @Optional() @InjectErrorReporter() private readonly errors?: ErrorReporter,
    ) {}

    /** The files of one customer message as its line keeps them, in the order sent; at most `CUSTOMER_FILES_MAX`. */
    keep(
        workspaceId: string,
        channelEventId: string,
        attachments: ReadonlyArray<CustomerAttachment>,
    ): Promise<ReadonlyArray<CustomerFile>> {
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
    ): Promise<CustomerFile> {
        const at: NotKeptAt = { workspaceId, channelEventId, index, kind: attachment.kind, name: attachment.name }
        if (attachment.url === "") return this.notKept(at, "no_address", null)
        if (this.assets === undefined) return this.notKept(at, "no_store", null)
        try {
            const answer = await this.remote.read({
                url: attachment.url,
                maxBytes: CHAT_FILE_MAX_BYTES,
                timeoutMs: FETCH_TIMEOUT_MS,
                accepts: isWanted,
            })
            const bytes = answer.bytes
            const contentType = bytes === null ? null : sniffChatFile(bytes)
            if (bytes === null || contentType === null) return this.notKept(at, `refused_${answer.status}`, null)
            const path = customerObjectPathOf(workspaceId, channelEventId, index, contentType)
            const written = await this.assets.upload(CHAT_FILE_BUCKET, path, bytes, contentType)
            if (written.error !== null) return this.notKept(at, "store_failed", written.error)
            return { id: path, url: `${CUSTOMER_FILE_REF}${path}`, name: chatFileNameOf(attachment.name, path), contentType }
        } catch (cause) {
            return this.notKept(at, "fetch_failed", cause)
        }
    }

    /**
     * The line's entry of a file that was not kept, with why in its id, after ONE app error is recorded for it (the event, the index,
     * the reason; the cause when there is one, else the remote files' typed failure). A report never throws.
     */
    private async notKept(at: NotKeptAt, reason: FileNotKept, cause: unknown): Promise<CustomerFile> {
        this.logger.warn(ChatFilesLogEvent.CustomerFileNotKept, { reason, channelEventId: at.channelEventId, index: at.index })
        const error = isDomainError(cause)
            ? cause
            : new RemoteFilesError({ code: RemoteFilesErrorCode.RequestFailed, params: { reason }, cause })
        await this.errors?.report(NOT_KEPT_SCOPE, error, {
            workspaceId: at.workspaceId,
            event: at.channelEventId,
            index: at.index,
            reason,
        })
        return unreadFileOf(at.index, at.kind, at.name, reason)
    }
}

/** Where a file that was not kept belongs: the workspace, the event it came with, its place and kind there. */
interface NotKeptAt {
    readonly workspaceId: string
    readonly channelEventId: string
    readonly index: number
    readonly kind: "image" | "file"
    readonly name: string
}
