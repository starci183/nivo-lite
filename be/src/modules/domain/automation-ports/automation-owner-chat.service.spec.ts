import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ConnectionSecretsErrorCode, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { TELEGRAM } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { AutomationOwnerChatService } from "./automation-owner-chat.service"
import { AutomationPortsLogEvent } from "./automation-ports.log-events"

const WS = "workspace-1"
const TEXT = "Today's report"

const connectionOf = builder<ConnectionRecord>({
    id: "connection-1",
    workspaceId: WS,
    provider: "telegram",
    name: "Shop bot",
    meta: { owner_chat_id: "owner-chat-1" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "person-1",
    createdAt: "2026-10-01T00:00:00.000Z",
})

const setup = async () => {
    const connections = mock<ConnectionsService>()
    connections.listByProvider.mockResolvedValue([connectionOf()])
    const secrets = mock<ConnectionSecretsService>()
    secrets.botToken.mockResolvedValue(ok("test-bot-token"))
    const telegram = mock<TelegramClient>()
    telegram.sendMessage.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationOwnerChatService,
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: TELEGRAM, useValue: telegram },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { subject: moduleRef.get(AutomationOwnerChatService), connections, secrets, telegram, logger }
}

describe("AutomationOwnerChatService", () => {
    it("sends the report through the workspace's connected Telegram bot", async () => {
        const { subject, connections, secrets, telegram, logger } = await setup()

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(true)

        expect(connections.listByProvider).toHaveBeenCalledWith(WS, "telegram", { includeDisconnected: false })
        expect(secrets.botToken).toHaveBeenCalledWith(WS, "connection-1")
        expect(telegram.sendMessage).toHaveBeenCalledWith("test-bot-token", "owner-chat-1", TEXT)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("answers false when the workspace has no Telegram connections", async () => {
        const { subject, connections, secrets, telegram } = await setup()
        connections.listByProvider.mockResolvedValue([])

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(false)

        expect(secrets.botToken).not.toHaveBeenCalled()
        expect(telegram.sendMessage).not.toHaveBeenCalled()
    })

    it("skips disconnected bots and bots with no registered owner chat or usable token", async () => {
        const { subject, connections, secrets, telegram } = await setup()
        connections.listByProvider.mockResolvedValue([
            connectionOf({ id: "disconnected", status: "disconnected" }),
            connectionOf({ id: "pending", status: "pending" }),
            connectionOf({ id: "error", status: "error" }),
            connectionOf({ id: "no-chat", meta: {} }),
            connectionOf({ id: "empty-chat", meta: { owner_chat_id: "" } }),
            connectionOf({ id: "no-token" }),
        ])
        secrets.botToken.mockResolvedValue(refused(ConnectionSecretsErrorCode.NotFound))

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(false)

        expect(secrets.botToken.mock.calls).toEqual([[WS, "no-token"]])
        expect(telegram.sendMessage).not.toHaveBeenCalled()
    })

    it("stops after the first successful send without looking up later tokens", async () => {
        const { subject, connections, secrets, telegram } = await setup()
        connections.listByProvider.mockResolvedValue([connectionOf(), connectionOf({ id: "later" })])

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(true)

        expect(secrets.botToken.mock.calls).toEqual([[WS, "connection-1"]])
        expect(telegram.sendMessage).toHaveBeenCalledTimes(1)
    })

    it("logs a failed send and tries the next connection with its own token and chat", async () => {
        const { subject, connections, secrets, telegram, logger } = await setup()
        const failure = new Error("Telegram unavailable")
        connections.listByProvider.mockResolvedValue([
            connectionOf(),
            connectionOf({ id: "connection-2", meta: { owner_chat_id: "owner-chat-2" } }),
        ])
        secrets.botToken.mockResolvedValueOnce(ok("first-test-token")).mockResolvedValueOnce(ok("second-test-token"))
        telegram.sendMessage.mockRejectedValueOnce(failure)

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(true)

        expect(telegram.sendMessage.mock.calls).toEqual([
            ["first-test-token", "owner-chat-1", TEXT],
            ["second-test-token", "owner-chat-2", TEXT],
        ])
        expect(logger.error).toHaveBeenCalledWith(AutomationPortsLogEvent.OwnerChatSendFailed, failure, {
            workspaceId: WS,
            connectionId: "connection-1",
        })
    })

    it("answers false after all reachable connections reject the send", async () => {
        const { subject, telegram, logger } = await setup()
        const failure = new Error("Telegram rejected the chat")
        telegram.sendMessage.mockRejectedValue(failure)

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(false)

        expect(logger.error).toHaveBeenCalledWith(AutomationPortsLogEvent.OwnerChatSendFailed, failure, {
            workspaceId: WS,
            connectionId: "connection-1",
        })
    })

    it("logs a failed connection lookup and answers false", async () => {
        const { subject, connections, secrets, telegram, logger } = await setup()
        const failure = new Error("Connections unavailable")
        connections.listByProvider.mockRejectedValue(failure)

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(false)

        expect(connections.listByProvider.mock.calls).toEqual([[WS, "telegram", { includeDisconnected: false }]])
        expect(secrets.botToken).not.toHaveBeenCalled()
        expect(telegram.sendMessage).not.toHaveBeenCalled()
        expect(logger.error.mock.calls).toEqual([
            [AutomationPortsLogEvent.OwnerChatLookupFailed, failure, { workspaceId: WS }],
        ])
    })

    it("logs a failed token lookup and answers false without trying later connections", async () => {
        const { subject, connections, secrets, telegram, logger } = await setup()
        const failure = new Error("Token lookup unavailable")
        connections.listByProvider.mockResolvedValue([connectionOf(), connectionOf({ id: "later" })])
        secrets.botToken.mockRejectedValue(failure)

        await expect(subject.sendToOwner(WS, TEXT)).resolves.toBe(false)

        expect(secrets.botToken.mock.calls).toEqual([[WS, "connection-1"]])
        expect(telegram.sendMessage).not.toHaveBeenCalled()
        expect(logger.error.mock.calls).toEqual([
            [AutomationPortsLogEvent.OwnerChatLookupFailed, failure, { workspaceId: WS }],
        ])
    })
})
