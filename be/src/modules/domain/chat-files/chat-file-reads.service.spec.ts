import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { DOCUMENTS } from "@modules/integrations/documents"
import type { DocumentsPort } from "@modules/integrations/documents"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatFileReadsService } from "./chat-file-reads.service"
import type { StoredChatFile } from "./chat-files.contracts"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import { ChatFilesService } from "./chat-files.service"

const TURN = { workspaceId: "ws-1", messageId: "m-1", module: "chatbot" }
const PICTURE: StoredChatFile = {
    id: "f-1",
    name: "a.png",
    contentType: "image/png",
    bytes: Uint8Array.from([1, 2, 3]),
    read: null,
}
const USAGE = { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.001 }
const CLEAR = { is_transfer: true, amount_vnd: 3_500_000, recipient: "SHOP", paid_at: "10:00", clear: true }
const READ = { isTransfer: true, amountVnd: 3_500_000, recipient: "SHOP", paidAt: "10:00" }

const build = async (file: StoredChatFile | null, parsed: unknown = CLEAR) => {
    const files = mock<ChatFilesService>({
        storedOf: jest.fn().mockResolvedValue(file),
        keepRead: jest.fn().mockResolvedValue(undefined),
    })
    const ai = mock<AiService>({
        chat: jest.fn().mockResolvedValue({ text: "{}", parsed, model: "m", usage: USAGE, retrieved: 0 }),
    })
    const documents = mock<DocumentsPort>({ readFile: jest.fn().mockResolvedValue("Amount 3.500.000") })
    const usage = mock<UsageGateService>({ record: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatFileReadsService,
            { provide: AI, useValue: ai },
            { provide: DOCUMENTS, useValue: documents },
            { provide: LOGGER, useValue: logger },
            { provide: ChatFilesService, useValue: files },
            { provide: UsageGateService, useValue: usage },
        ],
    }).compile()
    return { files, ai, documents, usage, logger, service: moduleRef.get(ChatFileReadsService) }
}

describe("ChatFileReadsService.readOf", () => {
    it("has no read for a message with no file, and no model is called", async () => {
        const { service, ai } = await build(null)
        await expect(service.readOf(TURN)).resolves.toBeNull()
        expect(ai.chat).not.toHaveBeenCalled()
    })

    it("has no read for a wake that names no message, and the store is not asked", async () => {
        const { service, files } = await build(PICTURE)
        await expect(service.readOf({ ...TURN, messageId: null })).resolves.toBeNull()
        expect(files.storedOf).not.toHaveBeenCalled()
    })

    it("sends a picture to the model, keeps the read on the file and meters the call", async () => {
        const { service, ai, files, usage } = await build(PICTURE)
        await expect(service.readOf(TURN)).resolves.toEqual(READ)
        const user = ai.chat.mock.calls[0]?.[0].messages[1]
        expect(user?.images).toEqual(["data:image/png;base64,AQID"])
        expect(files.keepRead).toHaveBeenCalledWith("ws-1", "f-1", READ)
        expect(usage.record).toHaveBeenCalledTimes(1)
    })

    it("sends a document as its text, which needs no file support of the model", async () => {
        const { service, ai, documents } = await build({ ...PICTURE, name: "a.pdf", contentType: "application/pdf" })
        await service.readOf(TURN)
        expect(documents.readFile).toHaveBeenCalledTimes(1)
        const user = ai.chat.mock.calls[0]?.[0].messages[1]
        expect(user?.images).toEqual([])
        expect(user?.content).toContain("3.500.000")
    })

    it("answers a kept read without paying the model again", async () => {
        const { service, ai } = await build({ ...PICTURE, read: READ })
        await expect(service.readOf(TURN)).resolves.toEqual(READ)
        expect(ai.chat).not.toHaveBeenCalled()
    })

    it("leaves the amount missing when the model has no answer", async () => {
        const { service, ai, files } = await build(PICTURE)
        ai.chat.mockResolvedValue(null)
        await expect(service.readOf(TURN)).resolves.toMatchObject({ amountVnd: null, isTransfer: true })
        expect(files.keepRead).toHaveBeenCalledTimes(1)
    })

    it("leaves the amount missing and logs when a read throws", async () => {
        const { service, documents, logger } = await build({ ...PICTURE, contentType: "application/pdf" })
        documents.readFile.mockRejectedValue(new Error("no text"))
        await expect(service.readOf(TURN)).resolves.toMatchObject({ amountVnd: null })
        expect(logger.error).toHaveBeenCalledWith(ChatFilesLogEvent.ReadFailed, expect.any(Error), {
            workspaceId: "ws-1",
        })
    })
})

describe("ChatFileReadsService.attachmentsOf", () => {
    it("gives the agent a picture as base64", async () => {
        const { service } = await build(PICTURE)
        await expect(service.attachmentsOf(TURN)).resolves.toEqual([
            { fileName: "a.png", mimeType: "image/png", content: "AQID" },
        ])
    })

    it("gives no attachment for a document or an empty message", async () => {
        const pdf = await build({ ...PICTURE, contentType: "application/pdf" })
        const none = await build(null)
        await expect(pdf.service.attachmentsOf(TURN)).resolves.toEqual([])
        await expect(none.service.attachmentsOf(TURN)).resolves.toEqual([])
    })
})
