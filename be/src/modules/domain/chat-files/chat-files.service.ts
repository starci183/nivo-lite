import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { In } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    CHAT_FILE_BUCKET,
    CHAT_FILE_MAX_BYTES,
    chatFileNameOf,
    chatFilePathOf,
    isAcceptedChatFile,
    isChatFilePath,
    sniffChatFile,
} from "./chat-file.policy"
import type {
    ChatFileFacts,
    ChatFileScope,
    ChatFileUpload,
    ChatFileView,
    ChatFileRead,
    OptionalStoredChatFile,
    VerifiedChatFile,
} from "./chat-files.contracts"
import { InjectChatFilesStorage } from "./chat-files.decorators"
import { ChatFilesError, ChatFilesErrorCode } from "./errors/chat-files.error"
import { AgentMessageAttachmentEntity } from "./persistence/entities"

/** Private read addresses expire after one hour. */
const SIGN_SECONDS = 3600
/** The most files one thread read signs. */
const VIEWS_MAX = 200
/** The refusal of the store when the object is not there. */
const NOT_FOUND = "OBJECT_STORAGE_NOT_FOUND"

/** The one row `gen_random_uuid()` answers: the new object name. */
interface AllocatedId {
    readonly gen_random_uuid: string
}

@Injectable()
/**
 * The files of a conversation. The browser PUTs straight to the private store at an address issued here, and the message names the
 * path: only then the object is read back, and only what the bytes prove is attached. Who may do this is proved by the caller.
 */
export class ChatFilesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectChatFilesStorage() private readonly storage: StorageObjectsPort,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly entitlements: EntitlementsService,
    ) {}

    /** Issues a unique address inside the folder of the conversation, within the storage plan of the workspace. */
    async requestUpload(scope: ChatFileScope, file: ChatFileFacts): Promise<ChatFileUpload> {
        if (!isAcceptedChatFile(file)) throw new ChatFilesError({ code: ChatFilesErrorCode.FileInvalid })
        await this.entitlements.requireStorageFor(scope.workspaceId, file.sizeBytes)
        const [allocated] = await callDbFunction<AllocatedId>(this.entityManager, "gen_random_uuid", [])
        if (allocated === undefined) throw new ChatFilesError({ code: ChatFilesErrorCode.StorageUnavailable })
        const path = chatFilePathOf(scope, allocated.gen_random_uuid, file.contentType)
        const signed = await this.storage.signedUpload(CHAT_FILE_BUCKET, path)
        if (signed.kind !== "ok") throw new ChatFilesError({ code: ChatFilesErrorCode.StorageUnavailable })
        return { path, signedUrl: signed.value.signedUrl }
    }

    /** Proves a stored object is a file of this conversation within the limit; an object that is not is removed from the store. */
    async verify(scope: ChatFileScope, path: string, name: string): Promise<VerifiedChatFile> {
        if (!isChatFilePath(scope, path)) throw new ChatFilesError({ code: ChatFilesErrorCode.PathInvalid })
        const size = await this.storage.sizeOf(CHAT_FILE_BUCKET, path)
        if (size.kind !== "ok") throw this.unreadable(size.code)
        if (size.value > CHAT_FILE_MAX_BYTES) return this.refuse(path)
        const stored = await this.storage.download(CHAT_FILE_BUCKET, path)
        if (stored.kind !== "ok") throw this.unreadable(stored.code)
        const contentType = sniffChatFile(stored.value.bytes)
        if (contentType === null) return this.refuse(path)
        return { path, name: chatFileNameOf(name, path), contentType, sizeBytes: size.value }
    }

    /** The words a message with a file stands on: what was written, else one line that says a file was sent. */
    wordsOf(written: string, locale: Locale): string {
        return written.trim() === "" ? this.catalog.get("chatFiles.fileSent", {}, locale) : written
    }

    /** Records a checked file on its message, in the transaction that stores the message. */
    async attach(
        scope: ChatFileScope,
        file: VerifiedChatFile,
        messageId: string,
        manager: EntityManager,
    ): Promise<void> {
        await manager.insert(AgentMessageAttachmentEntity, {
            workspaceId: scope.workspaceId,
            conversationId: scope.conversationId,
            messageId,
            path: file.path,
            name: file.name,
            contentType: file.contentType,
            sizeBytes: file.sizeBytes,
        })
    }

    /** The files of the messages with short-lived addresses; a file the store no longer holds is left out. */
    async viewsOf(workspaceId: string, messageIds: ReadonlyArray<string>): Promise<ReadonlyArray<ChatFileView>> {
        if (messageIds.length === 0) return []
        const rows = await this.entityManager.find(AgentMessageAttachmentEntity, {
            where: { workspaceId, messageId: In([...messageIds]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: VIEWS_MAX,
        })
        if (rows.length === 0) return []
        const signed = await this.storage.signedUrls(
            CHAT_FILE_BUCKET,
            rows.map((row) => row.path),
            SIGN_SECONDS,
        )
        if (signed.kind !== "ok") throw new ChatFilesError({ code: ChatFilesErrorCode.StorageUnavailable })
        const urlOf = new Map(signed.value.map((file) => [file.path, file.signedUrl]))
        return rows.flatMap((row) => {
            const url = urlOf.get(row.path)
            return url === undefined
                ? []
                : [{ id: row.id, messageId: row.messageId, name: row.name, contentType: row.contentType, url }]
        })
    }

    /** The first file of a message with its bytes and what was read from it; null when there is none to read. */
    async storedOf(workspaceId: string, messageId: string): Promise<OptionalStoredChatFile> {
        const row = await this.entityManager.findOne(AgentMessageAttachmentEntity, {
            where: { workspaceId, messageId },
            order: { createdAt: "ASC", id: "ASC" },
        })
        if (row === null) return null
        const stored = await this.storage.download(CHAT_FILE_BUCKET, row.path)
        if (stored.kind !== "ok") return null
        return {
            id: row.id,
            name: row.name,
            contentType: row.contentType,
            bytes: stored.value.bytes,
            read: row.read,
        }
    }

    /** Keeps what a turn read from a file, so it is read once. */
    async keepRead(workspaceId: string, id: string, read: ChatFileRead): Promise<void> {
        await this.entityManager.update(AgentMessageAttachmentEntity, { id, workspaceId }, { read: { ...read } })
    }

    private unreadable(code: string): ChatFilesError {
        return new ChatFilesError({
            code: code === NOT_FOUND ? ChatFilesErrorCode.PathInvalid : ChatFilesErrorCode.StorageUnavailable,
        })
    }

    /** Removes what must not stay in the store; the refusal stands whether or not the removal succeeds. */
    private async refuse(path: string): Promise<never> {
        await this.storage.remove(CHAT_FILE_BUCKET, [path])
        throw new ChatFilesError({ code: ChatFilesErrorCode.FileInvalid })
    }
}
