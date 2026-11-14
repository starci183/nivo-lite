import { Injectable, Optional } from "@nestjs/common"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import {
    TEAM_CHAT_FILE_BUCKET,
    TEAM_CHAT_FILE_MAX_BYTES,
    TEAM_CHAT_FILE_URL_SECONDS,
    extensionOf,
    fileNameOf,
    filePathOf,
    isAcceptedType,
    nameInPath,
    typeOfExtension,
} from "./team-chat-file.policy"
import { InjectTeamChatStorage } from "./team-chat.decorators"
import type { Attachment, ChatUpload, TeamChatResult, UploadAsk } from "./team-chat.contracts"
import { chatDone, chatRefusal } from "./team-chat.policy"

@Injectable()
/**
 * The files of the team chat. A person asks for an upload address of a room, the browser PUTs straight to the private store, and the
 * message names the keys: only then is each object looked at (its size), and only what is within the limit becomes an attachment. A
 * file that is not is removed. Who may do this in the room is proved by the chat before it calls here.
 */
export class TeamChatFilesService {
    constructor(
        @InjectIds() private readonly ids: Ids,
        @InjectClock() private readonly clock: Clock,
        @Optional() @InjectTeamChatStorage() private readonly storage: StorageObjectsPort | null = null,
    ) {}

    /** Issues an address to PUT one file of the room to, after the type and the size were checked. */
    async requestUpload(workspaceId: string, roomId: string, ask: UploadAsk): Promise<TeamChatResult<ChatUpload>> {
        if (!isAcceptedType(ask.mimeType)) return chatRefusal(TeamChatErrorCode.FileTypeNotAllowed)
        if (!Number.isInteger(ask.sizeBytes) || ask.sizeBytes < 1 || ask.sizeBytes > TEAM_CHAT_FILE_MAX_BYTES)
            return chatRefusal(TeamChatErrorCode.FileTooLarge)
        if (this.storage === null) return chatRefusal(TeamChatErrorCode.StorageUnavailable)
        const path = filePathOf(workspaceId, roomId, this.ids.next(), fileNameOf(ask.fileName, ask.mimeType))
        const signed = await this.storage.signedUpload(TEAM_CHAT_FILE_BUCKET, path, ask.mimeType)
        if (signed.kind !== "ok") return chatRefusal(TeamChatErrorCode.StorageUnavailable)
        return chatDone({
            fileKey: path,
            uploadUrl: signed.value.signedUrl,
            method: "PUT",
            headers: [{ name: "Content-Type", value: ask.mimeType }],
            expiresAt: new Date(this.clock.now().getTime() + TEAM_CHAT_FILE_URL_SECONDS * 1000),
        })
    }

    /** Looks at the stored objects the keys name: each must be a file of this room within the limit, else it is removed and the send refuses with the first refusal in key order. */
    async verify(
        workspaceId: string,
        roomId: string,
        keys: ReadonlyArray<string>,
    ): Promise<TeamChatResult<ReadonlyArray<Attachment>>> {
        if (keys.length === 0) return chatDone([])
        const storage = this.storage
        if (storage === null) return chatRefusal(TeamChatErrorCode.StorageUnavailable)
        const checked = await Promise.all(keys.map((key) => this.check(storage, workspaceId, roomId, key)))
        const values = checked.flatMap((result) => (result.ok ? [result.value] : []))
        const [refusal] = checked.flatMap((result) => (result.ok ? [] : [result.refusal]))
        return refusal === undefined ? chatDone(values) : chatRefusal(refusal)
    }

    /** Short-lived read addresses of stored files by key; a key the store does not know has none. */
    async urlsOf(keys: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        if (keys.length === 0 || this.storage === null) return new Map()
        const signed = await this.storage.signedUrls(TEAM_CHAT_FILE_BUCKET, keys, TEAM_CHAT_FILE_URL_SECONDS)
        return signed.kind === "ok" ? new Map(signed.value.map((file) => [file.path, file.signedUrl])) : new Map()
    }

    /** One key: the file it names when it is a file of this room of an allowed type within the limit; an object over the limit is removed. */
    private async check(
        storage: StorageObjectsPort,
        workspaceId: string,
        roomId: string,
        key: string,
    ): Promise<TeamChatResult<Attachment>> {
        const name = nameInPath(workspaceId, roomId, key)
        const mimeType = name === null ? null : typeOfExtension(extensionOf(name))
        if (name === null || mimeType === null) return chatRefusal(TeamChatErrorCode.FileTypeNotAllowed)
        const size = await storage.sizeOf(TEAM_CHAT_FILE_BUCKET, key)
        if (size.kind !== "ok") return chatRefusal(TeamChatErrorCode.StorageUnavailable)
        if (size.value > TEAM_CHAT_FILE_MAX_BYTES) {
            await storage.remove(TEAM_CHAT_FILE_BUCKET, [key])
            return chatRefusal(TeamChatErrorCode.FileTooLarge)
        }
        return chatDone({ fileKey: key, name, mimeType, sizeBytes: size.value })
    }
}
