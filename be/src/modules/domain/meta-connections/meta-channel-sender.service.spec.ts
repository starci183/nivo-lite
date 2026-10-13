import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { CHANNEL_SENDER_REGISTRY } from "@modules/domain/channels"
import type { ChannelSenderRegistry } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient, SendResult } from "@modules/integrations/meta"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaChannelSender } from "./meta-channel-sender.service"

const target = (overrides: Partial<ConversationTarget> = {}): ConversationTarget => ({
    id: "conversation-1",
    workspaceId: "workspace-1",
    channel: "facebook",
    externalId: "person-1:archived:1730000000",
    connectionId: "connection-1",
    ...overrides,
})

const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "connection-1",
    workspaceId: "workspace-1",
    provider: "meta",
    name: "Shop",
    meta: { ig_id: "instagram-1" },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

const seal = (plain: string) => ({ plain, webhookSecret: "webhook-secret" })
const pageSecret = JSON.stringify({ pageId: "page-1", pageToken: "page-token" })

const build = async () => {
    const registry = mock<ChannelSenderRegistry>()
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(record())
    connections.readSecret.mockResolvedValue(seal(pageSecret))
    const meta = mock<MetaClient>()
    meta.deliverMessage.mockResolvedValue({ ok: true, ids: ["message-1"] })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaChannelSender,
            { provide: CHANNEL_SENDER_REGISTRY, useValue: registry },
            { provide: ConnectionsService, useValue: connections },
            { provide: META_CLIENT, useValue: meta },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(MetaChannelSender), registry, connections, meta, logger, moduleRef }
}

describe("MetaChannelSender", () => {
    it("registers its Facebook and Instagram channels when the module initializes", async () => {
        const { service, registry, moduleRef } = await build()

        await moduleRef.init()

        expect(service.channels).toEqual(["facebook", "instagram"])
        expect(registry.add.mock.calls).toEqual([[service]])
    })

    it("sends a Facebook reply to the person before the first archive colon", async () => {
        const { service, connections, meta } = await build()

        await expect(service.send(target(), "Hello from the Page")).resolves.toBe(true)

        expect(connections.find.mock.calls).toEqual([["workspace-1", "connection-1"]])
        expect(connections.readSecret.mock.calls).toEqual([["connection-1"]])
        expect(meta.deliverMessage.mock.calls).toEqual([
            [
                { pageId: "page-1", pageToken: "page-token", igId: "instagram-1" },
                "facebook",
                "person-1",
                "Hello from the Page",
                "standard",
            ],
        ])
    })

    it("sends an Instagram reply with an unarchived person id and no linked Instagram id", async () => {
        const { service, connections, meta } = await build()
        connections.find.mockResolvedValue(record({ meta: {} }))

        await expect(
            service.send(target({ channel: "instagram", externalId: "instagram-person-1" }), "Hello on Instagram"),
        ).resolves.toBe(true)

        expect(meta.deliverMessage.mock.calls).toEqual([
            [
                { pageId: "page-1", pageToken: "page-token", igId: null },
                "instagram",
                "instagram-person-1",
                "Hello on Instagram",
                "standard",
            ],
        ])
    })

    it.each([
        { label: "no connection", overrides: { connectionId: null } },
        { label: "no person id", overrides: { externalId: null } },
    ])("sends nothing with $label", async ({ overrides }) => {
        const { service, connections, meta } = await build()

        await expect(service.send(target(overrides), "Hello")).resolves.toBe(false)

        expect(connections.find).not.toHaveBeenCalled()
        expect(connections.readSecret).not.toHaveBeenCalled()
        expect(meta.deliverMessage).not.toHaveBeenCalled()
    })

    it("sends nothing when the connection no longer exists", async () => {
        const { service, connections, meta } = await build()
        connections.find.mockResolvedValue(null)

        await expect(service.send(target(), "Hello")).resolves.toBe(false)

        expect(connections.find.mock.calls).toEqual([["workspace-1", "connection-1"]])
        expect(connections.readSecret).not.toHaveBeenCalled()
        expect(meta.deliverMessage).not.toHaveBeenCalled()
    })

    it("returns false when the connection lookup fails", async () => {
        const { service, connections, meta } = await build()
        connections.find.mockRejectedValue(new Error("connection storage unavailable"))

        await expect(service.send(target(), "Hello")).resolves.toBe(false)

        expect(connections.find.mock.calls).toEqual([["workspace-1", "connection-1"]])
        expect(connections.readSecret).not.toHaveBeenCalled()
        expect(meta.deliverMessage).not.toHaveBeenCalled()
    })

    it("returns false when the secret cannot be read", async () => {
        const { service, connections, meta } = await build()
        connections.readSecret.mockRejectedValue(new Error("decryption failed"))

        await expect(service.send(target(), "Hello")).resolves.toBe(false)

        expect(connections.readSecret.mock.calls).toEqual([["connection-1"]])
        expect(meta.deliverMessage).not.toHaveBeenCalled()
    })

    it.each([
        { label: "absent", sealed: null },
        { label: "invalid JSON", sealed: seal("not-json") },
        { label: "no Page id", sealed: seal(JSON.stringify({ pageToken: "page-token" })) },
        { label: "no Page token", sealed: seal(JSON.stringify({ pageId: "page-1" })) },
    ])("returns false for a secret with $label", async ({ sealed }) => {
        const { service, connections, meta } = await build()
        connections.readSecret.mockResolvedValue(sealed)

        await expect(service.send(target(), "Hello")).resolves.toBe(false)

        expect(connections.readSecret.mock.calls).toEqual([["connection-1"]])
        expect(meta.deliverMessage).not.toHaveBeenCalled()
    })

    it.each<{ result: SendResult; expected: boolean }>([
        { result: { ok: true, ids: ["message-2"] }, expected: true },
        { result: { ok: false, reason: "recipient_unavailable" }, expected: false },
    ])("returns Meta's delivery verdict $expected", async ({ result, expected }) => {
        const { service, connections, meta } = await build()
        connections.find.mockResolvedValue(record({ meta: {} }))
        meta.deliverMessage.mockResolvedValue(result)

        await expect(service.send(target(), "Reply")).resolves.toBe(expected)

        expect(meta.deliverMessage.mock.calls).toEqual([
            [{ pageId: "page-1", pageToken: "page-token", igId: null }, "facebook", "person-1", "Reply", "standard"],
        ])
    })
})
