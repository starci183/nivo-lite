import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import {
    WEBHOOK_DELIVERY_CLIENT,
    WebhookDeliveryError,
    WebhookDeliveryErrorCode,
} from "@modules/integrations/webhook-delivery"
import type { WebhookDeliveryClient } from "@modules/integrations/webhook-delivery"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { IDS } from "@modules/platform/ids"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import { WebhookConnectionsService } from "./webhook-connections.service"
import { WEBHOOK_CONNECTIONS_OPTIONS } from "./webhook-connections.decorators"

const ACTOR: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
const NOW = new Date("2026-10-13T03:00:00.000Z")
const TARGET = "https://receiver.test:8443/events?source=nivo"
const KEY = "c6ff2de63fff411ecf7eaa80a82004d260c263e185c58732596c9b28c11db340"
const SECRET = new Secret("engine-secret")
const GENERATED_SECRET = /^[0-9a-f]{64}$/
const INPUT = { name: "  Lead feed  ", url: TARGET, events: ["lead.created", "deal.won", "lead.created", "unknown"] }
const BODY =
    '{"id":"00000000-0000-4000-8000-000000000001","event":"lead.created","workspa' +
    'ce_id":"ws-1","occurred_at":"2026-10-13T03:00:00.000Z","data":{"test":true,"' +
    'lead_id":"00000000-0000-0000-0000-000000000000","name":"NIVO ' +
    'test","phone":"0900000000","need":"NIVO sample event"}}'

const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "webhook",
    name: "Lead feed",
    meta: { host: "receiver.test:8443", events: "lead.created,deal.won" },
    status: "pending",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

const build = async (signing = true, origin: string | null = "https://nivo.vn") => {
    const options = { signingSecret: signing ? SECRET : undefined }
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.publicOrigin.mockReturnValue(origin)
    connections.get.mockResolvedValue(record())
    connections.create.mockResolvedValue("c1")
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ url: TARGET }), webhookSecret: "stored-secret" })
    const delivery = mock<WebhookDeliveryClient>()
    delivery.resolveTarget.mockResolvedValue(new URL(TARGET))
    delivery.post.mockResolvedValue({ status: 204, failure: null, durationMs: 37 })
    const clock = new FakeClock(NOW)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookConnectionsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: WEBHOOK_DELIVERY_CLIENT, useValue: delivery },
            { provide: CLOCK, useValue: clock },
            { provide: IDS, useValue: fakeIds() },
            { provide: WEBHOOK_CONNECTIONS_OPTIONS, useValue: options },
        ],
    }).compile()
    return { service: moduleRef.get(WebhookConnectionsService), connections, delivery, clock }
}

describe("WebhookConnectionsService start", () => {
    it("seals the address, deduplicates events and stores and returns the signing key", async () => {
        const { service, connections, delivery } = await build()

        await expect(service.start(ACTOR, INPUT)).resolves.toEqual({
            id: "c1",
            name: "Lead feed",
            host: "receiver.test:8443",
            events: ["lead.created", "deal.won"],
            signingSecret: KEY,
        })
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner"])
        expect(delivery.resolveTarget).toHaveBeenCalledWith(TARGET, true)
        expect(connections.create).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            createdBy: "owner-1",
            provider: "webhook",
            name: "Lead feed",
            status: "pending",
            environment: "live",
            meta: { host: "receiver.test:8443", events: "lead.created,deal.won" },
            secret: {
                plain: '{"url":"https://receiver.test:8443/events?source=nivo"}',
                webhookSecret: expect.stringMatching(GENERATED_SECRET),
            },
        })
    })

    it("permits local targets when the deployment has no public origin and stores the resolved URL", async () => {
        const { service, connections, delivery } = await build(true, null)
        delivery.resolveTarget.mockResolvedValue(new URL("http://localhost:5678/webhook"))

        await expect(service.start(ACTOR, { ...INPUT, url: "http://localhost:5678/webhook" })).resolves.toEqual({
            id: "c1",
            name: "Lead feed",
            host: "localhost:5678",
            events: ["lead.created", "deal.won"],
            signingSecret: KEY,
        })
        expect(delivery.resolveTarget).toHaveBeenCalledWith("http://localhost:5678/webhook", false)
        expect(connections.create).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            createdBy: "owner-1",
            provider: "webhook",
            name: "Lead feed",
            status: "pending",
            environment: "live",
            meta: { host: "localhost:5678", events: "lead.created,deal.won" },
            secret: {
                plain: '{"url":"http://localhost:5678/webhook"}',
                webhookSecret: expect.stringMatching(GENERATED_SECRET),
            },
        })
    })

    it("refuses a name shorter than two characters before resolving or storing a target", async () => {
        const { service, connections, delivery } = await build()

        await expect(service.start(ACTOR, { ...INPUT, name: " x " })).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NameInvalid }),
        )
        expect(delivery.resolveTarget).not.toHaveBeenCalled()
        expect(connections.create).not.toHaveBeenCalled()
    })
})

describe("WebhookConnectionsService start", () => {
    it.each([{ events: [] }, { events: ["unknown"] }])(
        "refuses events that select nothing: $events",
        async ({ events }) => {
            const { service, connections, delivery } = await build()

            await expect(service.start(ACTOR, { ...INPUT, events })).rejects.toEqual(
                new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.EventsEmpty }),
            )
            expect(delivery.resolveTarget).not.toHaveBeenCalled()
            expect(connections.create).not.toHaveBeenCalled()
        },
    )

    it("refuses to store a target when outgoing signing is unavailable", async () => {
        const { service, connections } = await build(false)

        await expect(service.start(ACTOR, INPUT)).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.SigningUnavailable }),
        )
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("translates target refusal and preserves its cause", async () => {
        const { service, connections, delivery } = await build()
        const cause = new WebhookDeliveryError({
            code: WebhookDeliveryErrorCode.TargetRefused,
            params: { reason: "private-address" },
        })
        delivery.resolveTarget.mockRejectedValue(cause)

        await expect(service.start(ACTOR, INPUT)).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.UrlRefused, cause }),
        )
        await expect(service.start(ACTOR, INPUT)).rejects.toHaveProperty("cause", cause)
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("propagates an unexpected target resolution error unchanged", async () => {
        const { service, connections, delivery } = await build()
        const failure = new Error("resolver failed")
        delivery.resolveTarget.mockRejectedValue(failure)

        await expect(service.start(ACTOR, INPUT)).rejects.toBe(failure)
        expect(connections.create).not.toHaveBeenCalled()
    })
})

describe("WebhookConnectionsService reveal", () => {
    it("returns the stored host and valid events with the workspace signing key", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(
            record({ meta: { host: "receiver.test:8443", events: "deal.won, lead.created,unknown,deal.won" } }),
        )

        await expect(service.reveal(ACTOR, "c1")).resolves.toEqual({
            id: "c1",
            name: "Lead feed",
            host: "receiver.test:8443",
            events: ["deal.won", "lead.created"],
            signingSecret: KEY,
        })
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner"])
        expect(connections.get).toHaveBeenCalledWith("ws-1", "c1")
    })

    it("returns empty host and events when no public facts were stored", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ meta: {} }))

        await expect(service.reveal(ACTOR, "c1")).resolves.toEqual({
            id: "c1",
            name: "Lead feed",
            host: "",
            events: [],
            signingSecret: KEY,
        })
    })

    it("refuses a connection of another provider", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ provider: "telegram" }))

        await expect(service.reveal(ACTOR, "c1")).rejects.toEqual(
            new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: "c1" } }),
        )
    })
})

describe("WebhookConnectionsService updateEvents", () => {
    it("preserves other public facts and stores valid events once in selection order", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(
            record({ meta: { host: "receiver.test", events: "lead.created", extra: "keep" } }),
        )

        await expect(
            service.updateEvents(ACTOR, "c1", ["payment.received", "unknown", "deal.won", "payment.received"]),
        ).resolves.toEqual(["payment.received", "deal.won"])
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner"])
        expect(connections.get).toHaveBeenCalledWith("ws-1", "c1")
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            meta: { host: "receiver.test", events: "payment.received,deal.won", extra: "keep" },
        })
    })

    it("refuses an empty event selection without patching the connection", async () => {
        const { service, connections } = await build()

        await expect(service.updateEvents(ACTOR, "c1", ["unknown"])).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.EventsEmpty }),
        )
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("WebhookConnectionsService test", () => {
    it("posts the exact sample body and headers using the clock and workspace signing key", async () => {
        const { service, connections, delivery } = await build()

        await expect(service.test(ACTOR, "c1")).resolves.toEqual({
            ok: true,
            status: 204,
            error: null,
            durationMs: 37,
        })
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner", "manager"])
        expect(connections.get).toHaveBeenCalledWith("ws-1", "c1")
        expect(connections.readSecret).toHaveBeenCalledWith("c1")
        expect(delivery.resolveTarget).toHaveBeenCalledWith(TARGET, true)
        expect(delivery.post).toHaveBeenCalledWith({
            url: new URL(TARGET),
            body: BODY,
            headers: {
                "x-nivo-event": "lead.created",
                "x-nivo-delivery": "00000000-0000-4000-8000-000000000001",
                "x-nivo-timestamp": "1791860400000",
                "x-nivo-signature": "d4d0a995ac22f83a9fd36ee674d85d039de24ed4f4f6a6d5b6ddda2897d0d2f5",
                "x-nivo-test": "1",
            },
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { lastError: null })
    })

    it.each([
        { status: 199, ok: false, error: "HTTP_STATUS", lastError: "HTTP 199" },
        { status: 200, ok: true, error: null, lastError: null },
        { status: 299, ok: true, error: null, lastError: null },
        { status: 300, ok: false, error: "HTTP_STATUS", lastError: "HTTP 300" },
    ])("reports HTTP $status and records its verdict", async ({ status, ok, error, lastError }) => {
        const { service, connections, delivery } = await build()
        delivery.post.mockResolvedValue({ status, failure: null, durationMs: 19 })

        await expect(service.test(ACTOR, "c1")).resolves.toEqual({ ok, status, error, durationMs: 19 })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { lastError })
    })

    it.each([
        { failure: "timeout" as const, error: "TIMEOUT" },
        { failure: "unreachable" as const, error: "UNREACHABLE" },
    ])("reports $failure without writing an HTTP verdict", async ({ failure, error }) => {
        const { service, connections, delivery } = await build()
        delivery.post.mockResolvedValue({ status: null, failure, durationMs: 4000 })

        await expect(service.test(ACTOR, "c1")).resolves.toEqual({
            ok: false,
            status: null,
            error,
            durationMs: 4000,
        })
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("refuses a connection whose sealed secret is missing", async () => {
        const { service, connections, delivery } = await build()
        connections.readSecret.mockResolvedValue(null)

        await expect(service.test(ACTOR, "c1")).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NoUrl }),
        )
        expect(delivery.resolveTarget).not.toHaveBeenCalled()
        expect(delivery.post).not.toHaveBeenCalled()
    })
})

describe("WebhookConnectionsService test", () => {
    it.each(["null", '"string"', "3", "{}", '{"url":null}', '{"url":7}', '{"url":""}'])(
        "refuses a sealed value without a nonempty string address: %s",
        async (plain) => {
            const { service, connections, delivery } = await build()
            connections.readSecret.mockResolvedValue({ plain, webhookSecret: "stored-secret" })

            await expect(service.test(ACTOR, "c1")).rejects.toEqual(
                new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NoUrl }),
            )
            expect(delivery.resolveTarget).not.toHaveBeenCalled()
            expect(delivery.post).not.toHaveBeenCalled()
        },
    )

    it("refuses malformed sealed JSON before resolving or delivering", async () => {
        const { service, connections, delivery } = await build()
        connections.readSecret.mockResolvedValue({ plain: "not JSON", webhookSecret: "stored-secret" })

        await expect(service.test(ACTOR, "c1")).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NoUrl }),
        )
        expect(delivery.resolveTarget).not.toHaveBeenCalled()
        expect(delivery.post).not.toHaveBeenCalled()
    })

    it("requires a signing configuration before delivering", async () => {
        const { service, connections, delivery } = await build(false)

        await expect(service.test(ACTOR, "c1")).rejects.toEqual(
            new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.SigningUnavailable }),
        )
        expect(delivery.post).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("WebhookConnectionsService finish", () => {
    it("marks the owned webhook connected and clears its last error", async () => {
        const { service, connections } = await build()

        await expect(service.finish(ACTOR, "c1")).resolves.toBeUndefined()
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner"])
        expect(connections.get).toHaveBeenCalledWith("ws-1", "c1")
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { status: "connected", lastError: null })
    })
})

describe("WebhookConnectionsService", () => {
    it.each(["start", "reveal", "updateEvents", "test", "finish"] as const)(
        "does not continue %s after authorization is refused",
        async (method) => {
            const { service, connections, delivery } = await build()
            const failure = new Error("not authorized")
            connections.authorize.mockRejectedValue(failure)
            const attempt = {
                start: () => service.start(ACTOR, INPUT),
                reveal: () => service.reveal(ACTOR, "c1"),
                updateEvents: () => service.updateEvents(ACTOR, "c1", ["lead.created"]),
                test: () => service.test(ACTOR, "c1"),
                finish: () => service.finish(ACTOR, "c1"),
            }

            await expect(attempt[method]()).rejects.toBe(failure)
            expect(connections.get).not.toHaveBeenCalled()
            expect(connections.create).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
            expect(delivery.resolveTarget).not.toHaveBeenCalled()
            expect(delivery.post).not.toHaveBeenCalled()
        },
    )
})
