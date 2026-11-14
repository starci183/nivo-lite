import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { ToolsErrorCode, type NativeCaller } from "@modules/domain/tools"
import { PaymentLinkRegistryService, providerCallFailure, providerRefusal } from "@modules/domain/provider-registry"
import type { PaymentLink, PaymentLinkPort, PaymentLinkState } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { PAYMENT_REFUSAL_CLASS } from "./payment-refusal.policy"
import {
    LINK_CANCEL_SCHEMA,
    LINK_CREATE_SCHEMA,
    LINK_DESCRIPTION_MAX,
    LINK_GET_SCHEMA,
} from "./payment-link.schema"
import { PAYMENT_LINK_MANIFEST, PAYMENT_LINK_TOOL, PaymentLinkNativeService } from "./payment-link-native.service"

const ACCOUNT: ConnectionRecord = connectionRecord({ id: "conn-1", provider: "payos", name: "Pay" })
const caller = (connectionId?: string): NativeCaller => ({
    agentId: "agent-1",
    conversationId: null,
    ...(connectionId === undefined ? {} : { connectionId, provider: "payos" }),
})

// Handwritten from the member names of payOS's create answer (https://payos.vn/docs/api/ : paymentLinkId, orderCode, checkoutUrl, qrCode, amount, description, status).
const LINK: PaymentLink = {
    linkId: "124c33293c43417ab7879e14c8d9eb18",
    orderCode: 1789000000001,
    checkoutUrl: "https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18",
    qrPayload: "00020101021238570010A000000727",
    amountVnd: 150000,
    description: "DH001",
    status: "PENDING",
}
const STATE: PaymentLinkState = {
    linkId: LINK.linkId,
    orderCode: LINK.orderCode,
    amountVnd: 150000,
    amountPaidVnd: 0,
    amountRemainingVnd: 150000,
    status: "PENDING",
}
const CREATE_ARGS = {
    amountVnd: 150000,
    description: "DH001",
    returnUrl: "https://shop.example/paid",
    cancelUrl: "https://shop.example/cancelled",
}

const build = async (options: { readonly found?: ConnectionRecord | null } = {}) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(options.found === undefined ? ACCOUNT : options.found)
    const port = mock<PaymentLinkPort>({ provider: "payos" })
    port.create.mockResolvedValue(LINK)
    port.get.mockResolvedValue(STATE)
    port.cancel.mockResolvedValue({ ...STATE, status: "CANCELLED", canceledAt: "2026-11-13T10:05:00+07:00" })
    const registry = new PaymentLinkRegistryService()
    registry.register(port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentLinkNativeService,
            { provide: ConnectionsService, useValue: connections },
            { provide: PaymentLinkRegistryService, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentLinkNativeService), port, connections }
}

const paramsOf = (work: Promise<unknown>): Promise<unknown> =>
    Promise.resolve(work.then(
        () => null,
        (cause: unknown) => (typeof cause === "object" && cause !== null && "params" in cause ? cause.params : undefined) ?? cause,
    ))

describe("the payment-link manifest", () => {
    it("names its own purposes under nivo.tool, never the transfer one: create and cancel write (ask), get reads", () => {
        expect(PAYMENT_LINK_MANIFEST.tools.map((tool) => tool.domain)).toEqual([
            "nivo.tool.payment.link.create",
            "nivo.tool.payment.link.get",
            "nivo.tool.payment.link.cancel",
        ])
        expect(PAYMENT_LINK_MANIFEST.tools.map((tool) => [tool.scope, tool.defaultMode])).toEqual([
            ["write", "ask"],
            ["read", "auto"],
            ["write", "ask"],
        ])
        for (const tool of PAYMENT_LINK_MANIFEST.tools) {
            expect(`${PAYMENT_LINK_MANIFEST.namespace ?? ""}.${tool.name}`).toBe(tool.domain)
            expect(tool.internalOnly).toBe(true)
        }
    })
})

describe("the link arguments", () => {
    it("create takes a positive whole amount, a description, both return addresses, an optional reference and expiry, nothing else", () => {
        expect(LINK_CREATE_SCHEMA.safeParse(CREATE_ARGS).success).toBe(true)
        expect(LINK_CREATE_SCHEMA.safeParse({ ...CREATE_ARGS, reference: "DH-1", expiresAt: "2026-11-13T10:30:00+07:00" }).success).toBe(true)
        for (const bad of [
            { ...CREATE_ARGS, amountVnd: 0 },
            { ...CREATE_ARGS, amountVnd: 10.5 },
            { ...CREATE_ARGS, description: "  " },
            { ...CREATE_ARGS, description: "x".repeat(LINK_DESCRIPTION_MAX + 1) },
            { ...CREATE_ARGS, returnUrl: "not a url" },
            { ...CREATE_ARGS, cancelUrl: undefined },
            { ...CREATE_ARGS, returnUrl: undefined },
            { ...CREATE_ARGS, expiresAt: "tomorrow" },
            { ...CREATE_ARGS, extra: 1 },
        ]) {
            expect(LINK_CREATE_SCHEMA.safeParse(bad).success).toBe(false)
        }
    })

    it("get and cancel name the link by exactly one of linkId or orderCode", () => {
        for (const schema of [LINK_GET_SCHEMA, LINK_CANCEL_SCHEMA]) {
            expect(schema.safeParse({ linkId: "abc" }).success).toBe(true)
            expect(schema.safeParse({ orderCode: 12 }).success).toBe(true)
            expect(schema.safeParse({}).success).toBe(false)
            expect(schema.safeParse({ linkId: "abc", orderCode: 12 }).success).toBe(false)
            expect(schema.safeParse({ orderCode: 1.5 }).success).toBe(false)
        }
        expect(LINK_CANCEL_SCHEMA.safeParse({ orderCode: 12, reason: "Changed my mind" }).success).toBe(true)
    })
})

describe("PaymentLinkNativeService", () => {
    it("create: asks the port of the handed account and answers the members it gave, the caller's reference returned untouched", async () => {
        const { service, port, connections } = await build()

        const answer = await service.invoke(
            "ws-1",
            PAYMENT_LINK_TOOL.create,
            { ...CREATE_ARGS, reference: " DH-0001 ", expiresAt: "2026-11-13T10:30:00+07:00" },
            caller("conn-1"),
        )

        expect(connections.find).toHaveBeenCalledWith("ws-1", "conn-1")
        expect(port.create).toHaveBeenCalledWith(ACCOUNT, { ...CREATE_ARGS, expiresAt: "2026-11-13T10:30:00+07:00" })
        expect(answer).toEqual({ ...LINK, reference: " DH-0001 " })
    })

    it("create: no reference in, none out; an absent QR payload is left out", async () => {
        const { service, port } = await build()
        port.create.mockResolvedValue({ ...LINK, qrPayload: undefined })

        const answer = await service.invoke("ws-1", PAYMENT_LINK_TOOL.create, CREATE_ARGS, caller("conn-1"))

        expect(answer).not.toHaveProperty("reference")
        expect(answer).not.toHaveProperty("qrPayload")
    })

    it("get: by link id or order code, answering the state", async () => {
        const { service, port } = await build()

        const byId = await service.invoke("ws-1", PAYMENT_LINK_TOOL.get, { linkId: LINK.linkId }, caller("conn-1"))
        await service.invoke("ws-1", PAYMENT_LINK_TOOL.get, { orderCode: LINK.orderCode }, caller("conn-1"))

        expect(port.get).toHaveBeenNthCalledWith(1, ACCOUNT, { linkId: LINK.linkId })
        expect(port.get).toHaveBeenNthCalledWith(2, ACCOUNT, { orderCode: LINK.orderCode })
        expect(byId).toEqual(STATE)
    })

    it("cancel: by either id with the optional reason", async () => {
        const { service, port } = await build()

        const answer = await service.invoke("ws-1", PAYMENT_LINK_TOOL.cancel, { orderCode: 7, reason: "Changed my mind" }, caller("conn-1"))
        await service.invoke("ws-1", PAYMENT_LINK_TOOL.cancel, { linkId: "abc" }, caller("conn-1"))

        expect(port.cancel).toHaveBeenNthCalledWith(1, ACCOUNT, { orderCode: 7 }, "Changed my mind")
        expect(port.cancel).toHaveBeenNthCalledWith(2, ACCOUNT, { linkId: "abc" }, undefined)
        expect(answer).toMatchObject({ status: "CANCELLED", canceledAt: "2026-11-13T10:05:00+07:00" })
    })

    it("refuses not_connected, never picking an account itself, when none was handed or the port is missing", async () => {
        for (const name of [PAYMENT_LINK_TOOL.create, PAYMENT_LINK_TOOL.get, PAYMENT_LINK_TOOL.cancel]) {
            const args = name === PAYMENT_LINK_TOOL.create ? CREATE_ARGS : { orderCode: 1 }
            expect(await paramsOf((await build()).service.invoke("ws-1", name, args, caller()))).toEqual({
                reason: "not_connected",
                refusalClass: PAYMENT_REFUSAL_CLASS.not_connected,
            })
            expect(await paramsOf((await build({ found: null })).service.invoke("ws-1", name, args, caller("conn-1")))).toMatchObject({ reason: "not_connected" })
        }
    })

    it("maps the provider's refusals onto the payment refusals", async () => {
        const { service, port } = await build()
        port.create.mockRejectedValue(providerRefusal("payos", "rejected", "bad"))
        port.get.mockRejectedValue(providerRefusal("payos", "not_found"))
        port.cancel.mockRejectedValue(providerRefusal("payos", "auth_refused"))

        expect(await paramsOf(service.invoke("ws-1", PAYMENT_LINK_TOOL.create, CREATE_ARGS, caller("conn-1")))).toEqual({ reason: "rejected", refusalClass: "business" })
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_LINK_TOOL.get, { orderCode: 1 }, caller("conn-1")))).toEqual({ reason: "not_found", refusalClass: "business" })
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_LINK_TOOL.cancel, { orderCode: 1 }, caller("conn-1")))).toEqual({
            reason: "connection_refused",
            refusalClass: "infrastructure",
        })
    })

    it("lets a failure that proves something through as it is (the runner reads its proof: a timed-out create is unknown)", async () => {
        const { service, port } = await build()
        const failure = providerCallFailure("unknown")
        port.create.mockRejectedValue(failure)

        await expect(service.invoke("ws-1", PAYMENT_LINK_TOOL.create, CREATE_ARGS, caller("conn-1"))).rejects.toBe(failure)
    })

    it("rejects invalid arguments before any account is read", async () => {
        const { service, connections } = await build()

        await expect(service.invoke("ws-1", PAYMENT_LINK_TOOL.create, { amountVnd: 0 }, caller("conn-1"))).rejects.toBeDefined()
        expect(connections.find).not.toHaveBeenCalled()
    })

    it("treats an unknown tool as unknown", async () => {
        await expect((await build()).service.invoke("ws-1", "payment.link.nope", {}, caller("conn-1"))).rejects.toMatchObject({ code: ToolsErrorCode.UnknownTool })
    })
})
