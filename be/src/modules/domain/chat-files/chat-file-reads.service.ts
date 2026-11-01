import { Injectable } from "@nestjs/common"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { InjectDocuments } from "@modules/integrations/documents"
import type { DocumentsPort } from "@modules/integrations/documents"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    ChatFileRead,
    ChatFileTurn,
    ChatTurnAttachment,
    OptionalChatFileRead,
    OptionalStoredChatFile,
    StoredChatFile,
} from "./chat-files.contracts"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import { ChatFilesService } from "./chat-files.service"
import { fileReadOf, fileTextOf, isPictureFile, UNREADABLE_FILE } from "./file-read.policy"
import { fileReadSchema } from "./file-read.schema"
import { FILE_READ_IMAGE_REQUEST, FILE_READ_SYSTEM, FILE_READ_TEXT_REQUEST } from "./file-read.templates"

/** The whole read in milliseconds. */
const READ_TIMEOUT_MS = 30_000
/** The most tokens the answer of a read may take. */
const READ_MAX_TOKENS = 300
/** The usage kind a read is metered under: it is part of answering the customer. */
const USAGE_KIND = "chat_reply"

/** The message of a read, with the picture or the text of the file. */
interface ReadRequest {
    /** The words of the request. */
    readonly content: string
    /** The picture as a data address; empty for a document. */
    readonly images: ReadonlyArray<string>
}

@Injectable()
/**
 * Reads what the file of a message states about a transfer into a structured record, once. It reads by the message: who wrote it is the
 * business of the door that took it. The record stays on the file, so a retried turn and both steps of a turn see the same read and the model is paid once. A file that cannot be read gives an empty amount.
 */
export class ChatFileReadsService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectDocuments() private readonly documents: DocumentsPort,
        @InjectLogger() private readonly logger: Logger,
        private readonly files: ChatFilesService,
        private readonly usage: UsageGateService,
    ) {}

    /** The read of the first file of the turn's message, or null when the message holds no file. */
    async readOf(turn: ChatFileTurn): Promise<OptionalChatFileRead> {
        const { workspaceId } = turn
        const file = await this.fileOf(turn)
        if (file === null) return null
        if (file.read !== null) return file.read
        const read = await this.read(turn, file).catch((cause: unknown) => {
            this.logger.error(ChatFilesLogEvent.ReadFailed, cause, { workspaceId })
            return UNREADABLE_FILE
        })
        await this.files.keepRead(workspaceId, file.id, read)
        return read
    }

    /** The picture of the message for the agent to see; a document reaches it as its read, a text only the read can give. */
    async attachmentsOf(turn: ChatFileTurn): Promise<ReadonlyArray<ChatTurnAttachment>> {
        const file = await this.fileOf(turn)
        if (file === null || !isPictureFile(file.contentType)) return []
        const content = Buffer.from(file.bytes).toString("base64")
        return [{ fileName: file.name, mimeType: file.contentType, content }]
    }

    private fileOf(turn: ChatFileTurn): Promise<OptionalStoredChatFile> {
        return turn.messageId === null ? Promise.resolve(null) : this.files.storedOf(turn.workspaceId, turn.messageId)
    }

    private async read(turn: ChatFileTurn, file: StoredChatFile): Promise<ChatFileRead> {
        const request = await this.requestOf(file)
        const answer = await this.ai.chat({
            messages: [
                { role: "system", content: FILE_READ_SYSTEM },
                { role: "user", content: request.content, images: request.images },
            ],
            json: true,
            schema: fileReadSchema,
            timeoutMs: READ_TIMEOUT_MS,
            context: null,
            budget: { effort: "off", maxTokens: READ_MAX_TOKENS },
        })
        if (answer === null) return UNREADABLE_FILE
        await this.usage.record({
            workspaceId: turn.workspaceId,
            kind: USAGE_KIND,
            module: turn.module,
            usage: {
                prompt_tokens: answer.usage.promptTokens ?? 0,
                completion_tokens: answer.usage.completionTokens ?? 0,
                cached_tokens: 0,
                cost: answer.usage.costUsd ?? 0,
                model: answer.model,
            },
            completionChars: answer.text.length,
        })
        return fileReadOf(answer.parsed)
    }

    /** A picture goes to the model as it is; a document goes as its text, which needs no file support of the model. */
    private async requestOf(file: StoredChatFile): Promise<ReadRequest> {
        if (isPictureFile(file.contentType)) {
            const base64 = Buffer.from(file.bytes).toString("base64")
            return { content: FILE_READ_IMAGE_REQUEST, images: [`data:${file.contentType};base64,${base64}`] }
        }
        const text = await this.documents.readFile(file.name, file.bytes, file.contentType)
        return { content: `${FILE_READ_TEXT_REQUEST}\n\n${fileTextOf(text)}`, images: [] }
    }
}
