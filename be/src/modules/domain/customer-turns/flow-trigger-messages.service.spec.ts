import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChatFilesService } from "@modules/domain/chat-files"
import { FlowTriggerMessagesService } from "./flow-trigger-messages.service"

describe("FlowTriggerMessagesService", () => {
    it("answers the customer's messages in the order said, each with the files sent with it", async () => {
        const messages = mock<AgentMessagesService>({
            customerLinesOf: jest.fn().mockResolvedValue([
                { id: "m-1", body: "Chào shop", at: new Date("2026-11-04T01:00:00.000Z") },
                { id: "m-2", body: "Đã chuyển khoản", at: new Date("2026-11-04T01:00:05.000Z") },
            ]),
        })
        const files = mock<ChatFilesService>({
            viewsOf: jest.fn().mockResolvedValue([
                { id: "f-1", messageId: "m-2", name: "bidv.jpg", contentType: "image/jpeg", url: "https://files.test/f-1" },
            ]),
        })
        const moduleRef = await Test.createTestingModule({
            providers: [
                FlowTriggerMessagesService,
                { provide: AgentMessagesService, useValue: messages },
                { provide: ChatFilesService, useValue: files },
                { provide: AgentConversationsService, useValue: mock<AgentConversationsService>() },
            ],
        }).compile()

        await expect(moduleRef.get(FlowTriggerMessagesService).messagesOf("ws-1", "c-1", ["m-2", "m-1"])).resolves.toEqual([
            { id: "m-1", text: "Chào shop", at: "2026-11-04T01:00:00.000Z", attachments: [] },
            {
                id: "m-2",
                text: "Đã chuyển khoản",
                at: "2026-11-04T01:00:05.000Z",
                attachments: [{ id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "https://files.test/f-1" }],
            },
        ])
        expect(messages.customerLinesOf).toHaveBeenCalledWith("c-1", ["m-2", "m-1"])
        expect(files.viewsOf).toHaveBeenCalledWith("ws-1", ["m-1", "m-2"])
    })
})

describe("FlowTriggerMessagesService conversationOf", () => {
    it("answers the conversation's customer and channel, and null for one that is gone", async () => {
        const conversations = mock<AgentConversationsService>()
        conversations.turnOf
            .mockResolvedValueOnce({ kind: "ok", value: { leadId: "l-1", channel: "zalo" } } as never)
            .mockResolvedValueOnce({ kind: "refused", code: "x" } as never)
        const moduleRef = await Test.createTestingModule({
            providers: [
                FlowTriggerMessagesService,
                { provide: AgentMessagesService, useValue: mock<AgentMessagesService>() },
                { provide: ChatFilesService, useValue: mock<ChatFilesService>() },
                { provide: AgentConversationsService, useValue: conversations },
            ],
        }).compile()
        const service = moduleRef.get(FlowTriggerMessagesService)

        await expect(service.conversationOf("c-1")).resolves.toEqual({ leadId: "l-1", channel: "zalo" })
        await expect(service.conversationOf("c-2")).resolves.toBeNull()
    })
})
