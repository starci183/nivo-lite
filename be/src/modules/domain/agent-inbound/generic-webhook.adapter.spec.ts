import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { wakeTraitsOf } from "./inbound-adapter.policy"
import {
    GENERIC_WEBHOOK,
    deliveryIdOf,
    genericWebhookAdapter,
    idempotencyKeyOf,
    normalizeGenericWebhook,
    receiveGenericWebhook,
} from "./generic-webhook.adapter"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import type { GenericWebhookDelivery } from "./generic-webhook.adapter"

const SUBJECT = Symbol("generic-webhook.adapter")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { deliveryIdOf, idempotencyKeyOf, normalizeGenericWebhook, receiveGenericWebhook },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./generic-webhook.adapter")>(SUBJECT)
}

const delivery = (body: unknown, over: Partial<GenericWebhookDelivery> = {}): GenericWebhookDelivery => ({
    workspaceId: "ws-1",
    connectionId: "conn-1",
    rawBody: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
    eventType: undefined,
    deliveryKey: undefined,
    ...over,
})

const codeOf = (run: () => unknown): unknown => {
    try {
        run()
        return null
    } catch (cause) {
        return cause instanceof AgentInboundError ? cause.code : cause
    }
}

describe("genericWebhookAdapter", () => {
    it("proves events by signature, trusts the sender as an outsider, waits for nobody and replies on no channel", () => {
        expect(genericWebhookAdapter).toMatchObject({
            key: GENERIC_WEBHOOK,
            authentication: "signature",
            awaitsAnswer: false,
            replyStep: null,
        })
        expect(genericWebhookAdapter.trustOf({ kind: "webhook", id: "conn-1", role: null })).toBe("outsider")
    })

    it("is work a person may be waiting on, not background work: it is restored after a switch and never locks a conversation", () => {
        expect(wakeTraitsOf(genericWebhookAdapter)).toEqual({
            priority: 30,
            maxAttempts: 3,
            scopedToConversation: false,
            background: false,
            restoresHeld: true,
            awaitsAnswer: false,
        })
    })
})

describe("normalizeGenericWebhook", () => {
    it("turns a verified delivery into an inbound event of the endpoint workspace, to be matched by trigger", async () => {
        const { normalizeGenericWebhook } = await buildSubject()

        expect(normalizeGenericWebhook(delivery({ type: "invoice.paid", id: "evt-7", amount: 120 }))).toEqual({
            adapter: GENERIC_WEBHOOK,
            eventType: "invoice.paid",
            actor: { kind: "webhook", id: "conn-1", role: null },
            chain: null,
            payload: { type: "invoice.paid", id: "evt-7", amount: 120 },
            attachments: [],
            evidence: [
                { key: "endpoint", value: "conn-1", kind: "connection", via: GENERIC_WEBHOOK },
                { key: "signature", value: "hmac-sha256", kind: "proof", via: GENERIC_WEBHOOK },
            ],
            idempotencyKey: "conn-1:evt-7",
            workspaceId: "ws-1",
            agentId: null,
            scopeKey: null,
        })
    })

    it("takes the event type from the header first, then the body type, then the body event", async () => {
        const { normalizeGenericWebhook } = await buildSubject()

        expect(normalizeGenericWebhook(delivery({ type: "b" }, { eventType: "a" })).eventType).toBe("a")
        expect(normalizeGenericWebhook(delivery({ type: "b", event: "c" })).eventType).toBe("b")
        expect(normalizeGenericWebhook(delivery({ event: "c" })).eventType).toBe("c")
    })

    it.each([
        ["a body that is not JSON", "not json", AgentInboundErrorCode.BodyInvalid],
        ["a body that is a list", "[1,2]", AgentInboundErrorCode.BodyInvalid],
        ["a delivery that names no event type", "{}", AgentInboundErrorCode.EventTypeInvalid],
        ["an event type with spaces", '{"type":"two words"}', AgentInboundErrorCode.EventTypeInvalid],
        ["an event type that is not text", '{"type":7}', AgentInboundErrorCode.EventTypeInvalid],
    ])("refuses %s", async (_name, body, code) => {
        const { normalizeGenericWebhook } = await buildSubject()

        expect(codeOf(() => normalizeGenericWebhook(delivery(body)))).toBe(code)
    })
})

describe("idempotencyKeyOf", () => {
    it("is the key the sender named, else the body id, scoped to the endpoint and bounded", async () => {
        const { idempotencyKeyOf } = await buildSubject()

        expect(idempotencyKeyOf(delivery({}, { deliveryKey: "hdr-1" }), { id: "body-1" })).toBe("conn-1:hdr-1")
        expect(idempotencyKeyOf(delivery({}), { id: "body-1" })).toBe("conn-1:body-1")
        expect(idempotencyKeyOf(delivery({}, { deliveryKey: "k".repeat(500) }), {})).toBe("conn-1:" + "k".repeat(200))
    })

    it("falls back to the hash of the exact bytes, so a redelivery of the same body is one fact and another body is another", async () => {
        const { idempotencyKeyOf } = await buildSubject()
        const first = delivery({ a: 1 })
        const again = delivery({ a: 1 })
        const other = delivery({ a: 2 })
        const hash = createHash("sha256").update(first.rawBody).digest("hex")

        expect(idempotencyKeyOf(first, {})).toBe("conn-1:" + hash)
        expect(idempotencyKeyOf(again, {})).toBe(idempotencyKeyOf(first, {}))
        expect(idempotencyKeyOf(other, {})).not.toBe(idempotencyKeyOf(first, {}))
    })

    it("keeps the same key on two endpoints apart", async () => {
        const { idempotencyKeyOf } = await buildSubject()

        expect(idempotencyKeyOf(delivery({}, { connectionId: "conn-2" }), { id: "x" })).toBe("conn-2:x")
    })
})

describe("deliveryIdOf", () => {
    it("is the key the inbox claims: the same the event carries, read from the body alone", async () => {
        const { deliveryIdOf, normalizeGenericWebhook } = await buildSubject()
        const received = delivery({ type: "invoice.paid", id: "evt-7" })

        expect(deliveryIdOf(received)).toBe("conn-1:evt-7")
        expect(deliveryIdOf(received)).toBe(normalizeGenericWebhook(received).idempotencyKey)
    })

    it("refuses a body that is not a JSON object before anything is claimed", async () => {
        const { deliveryIdOf } = await buildSubject()

        expect(codeOf(() => deliveryIdOf(delivery("not json")))).toBe(AgentInboundErrorCode.BodyInvalid)
    })
})

describe("receiveGenericWebhook", () => {
    const verified = (body: string | undefined, over: object = {}) => ({
        endpoint: "conn-1",
        rawBody: body === undefined ? undefined : Buffer.from(body),
        signature: undefined,
        eventType: undefined,
        deliveryKey: undefined,
        ...over,
    })

    it("reads a verified delivery into the id the inbox claims and the receipt the job carries", async () => {
        const { receiveGenericWebhook } = await buildSubject()

        expect(
            receiveGenericWebhook(
                verified('{"type":"invoice.paid","id":"evt-1"}', { eventType: "invoice.paid", deliveryKey: "d-1" }),
            ),
        ).toEqual({
            deliveryId: "conn-1:d-1",
            payload: {
                connectionId: "conn-1",
                deliveryId: "conn-1:d-1",
                rawBody: '{"type":"invoice.paid","id":"evt-1"}',
                eventType: "invoice.paid",
                deliveryKey: "d-1",
            },
        })
    })

    it("keeps a header the sender did not send as null in the receipt", async () => {
        const { receiveGenericWebhook } = await buildSubject()

        expect(receiveGenericWebhook(verified('{"type":"x","id":"evt-1"}')).payload).toMatchObject({
            deliveryId: "conn-1:evt-1",
            eventType: null,
            deliveryKey: null,
        })
    })

    it.each([
        ["a delivery with no body", undefined, AgentInboundErrorCode.EndpointUnknown],
        ["a body that is a list", "[1]", AgentInboundErrorCode.BodyInvalid],
        ["a body that names no event type", '{"note":"x"}', AgentInboundErrorCode.EventTypeInvalid],
    ])("refuses %s before anything is claimed", async (_name, body, code) => {
        const { receiveGenericWebhook } = await buildSubject()

        expect(codeOf(() => receiveGenericWebhook(verified(body)))).toBe(code)
    })
})
