import * as fs from "node:fs"
import type { ConnectionRecord } from "@modules/domain/connections"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { PAYOS_SANDBOX_CASE, PAYOS_SANDBOX_CATALOGUE } from "./payos-sandbox.catalogue"
import { PayosSandboxPaymentLinkService } from "./payos-sandbox-payment-link.service"

const ACCOUNT = sandboxAccount({ id: "conn-p", workspaceId: "ws-1", provider: "payos" })
const CONNECTION: ConnectionRecord = connectionRecord({ id: "conn-p", workspaceId: "ws-1", provider: "payos", sandbox: true })
const LIVE_CONNECTION: ConnectionRecord = connectionRecord({ id: "conn-live", workspaceId: "ws-1", provider: "payos" })
const REQUEST = { amountVnd: 150000, description: "DH001", returnUrl: "https://shop.example/paid", cancelUrl: "https://shop.example/cancelled" }

const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new PayosSandboxPaymentLinkService(sandbox) }
}

/** What a rejected promise threw. */
const thrownOf = (run: Promise<unknown>): Promise<unknown> => run.catch((cause: unknown) => cause)

describe("PayosSandboxPaymentLinkService", () => {
    it("is the payment-link port of the payos provider key", () => {
        expect(setup().service.provider).toBe("payos")
    })

    it("PAYOS-1: creates a PENDING link whose id and order code come from state, and logs exactly one create call", async () => {
        const { sandbox, service } = setup()

        const first = await service.create(CONNECTION, REQUEST)
        const second = await service.create(CONNECTION, REQUEST)

        expect(first).toEqual({
            linkId: "sbx-payos-link-000001",
            orderCode: 1780000000001,
            checkoutUrl: "https://pay.payos.vn/web/sbx-payos-link-000001",
            qrPayload: "00020101021238570010A000000727sandbox",
            amountVnd: 150000,
            description: "DH001",
            status: "PENDING",
        })
        expect([second.linkId, second.orderCode]).toEqual(["sbx-payos-link-000002", 1780000000002])
        const calls = await sandbox.calls(ACCOUNT, "create")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ operation: "create", key: "DH001", request: REQUEST, result: { outcome: "answered", value: first } })
    })

    it("echoes the expiry asked", async () => {
        const link = await setup().service.create(CONNECTION, { ...REQUEST, expiresAt: "2026-11-15T10:00:00.000Z" })
        expect(link.expiresAt).toBe("2026-11-15T10:00:00.000Z")
    })

    it("PAYOS-2: the account's next case refuses the create as rejected, with payOS's words, no proof attached, no link made; the request's description picks nothing", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "create", PAYOS_SANDBOX_CASE.createRefused)

        const thrown = await thrownOf(service.create(CONNECTION, REQUEST))

        expect(providerRefusalReason(thrown)).toBe("rejected")
        expect(providerRefusalDetail(thrown)).toBe("order already exists")
        expect(proofOf(thrown)).toBeNull()
        await sandbox.setNextCase(ACCOUNT, "create", PAYOS_SANDBOX_CASE.created)
        expect((await service.create(CONNECTION, REQUEST)).linkId).toBe("sbx-payos-link-000002")
        expect(await sandbox.calls(ACCOUNT, "create")).toHaveLength(2)
    })

    it("PAYOS-6: the next case answers not found to a read of a link the account holds; PAYOS-7 refuses the cancel of a pending link, which stays pending", async () => {
        const { sandbox, service } = setup()
        const link = await service.create(CONNECTION, REQUEST)

        await sandbox.setNextCase(ACCOUNT, "get", PAYOS_SANDBOX_CASE.readNotFound)
        await sandbox.setNextCase(ACCOUNT, "cancel", PAYOS_SANDBOX_CASE.cancelRefused)

        expect(providerRefusalReason(await thrownOf(service.get(CONNECTION, { linkId: link.linkId })))).toBe("not_found")
        const refused = await thrownOf(service.cancel(CONNECTION, { linkId: link.linkId }, undefined))
        expect([providerRefusalReason(refused), providerRefusalDetail(refused), proofOf(refused)]).toEqual(["rejected", "link is not pending", null])
        await sandbox.setNextCase(ACCOUNT, "get", PAYOS_SANDBOX_CASE.read)
        expect((await service.get(CONNECTION, { linkId: link.linkId })).status).toBe("PENDING")
    })

    it("PAYOS-4: reads a created link by its id and by its order code, and refuses an unknown one as not found", async () => {
        const { service } = setup()
        const link = await service.create(CONNECTION, REQUEST)

        const byId = await service.get(CONNECTION, { linkId: link.linkId })
        const byCode = await service.get(CONNECTION, { orderCode: link.orderCode })

        expect(byId).toEqual({
            linkId: "sbx-payos-link-000001",
            orderCode: 1780000000001,
            amountVnd: 150000,
            amountPaidVnd: 0,
            amountRemainingVnd: 150000,
            status: "PENDING",
            createdAt: "2026-11-14T10:00:00+07:00",
        })
        expect(byCode).toEqual(byId)
        const thrown = await thrownOf(service.get(CONNECTION, { linkId: "nope" }))
        expect(providerRefusalReason(thrown)).toBe("not_found")
        expect(providerRefusalReason(await thrownOf(service.get(CONNECTION, { orderCode: 42 })))).toBe("not_found")
    })

    it("PAYOS-5: cancels a pending link with the reason, then refuses a second cancel as rejected; an unknown link is not found", async () => {
        const { service } = setup()
        const link = await service.create(CONNECTION, REQUEST)

        const cancelled = await service.cancel(CONNECTION, { orderCode: link.orderCode }, "customer changed mind")

        expect(cancelled).toMatchObject({ status: "CANCELLED", canceledAt: "2026-11-14T10:00:00+07:00", cancellationReason: "customer changed mind" })
        expect((await service.get(CONNECTION, { linkId: link.linkId })).status).toBe("CANCELLED")
        const again = await thrownOf(service.cancel(CONNECTION, { linkId: link.linkId }, undefined))
        expect(providerRefusalReason(again)).toBe("rejected")
        expect(providerRefusalDetail(again)).toBe("link is not pending")
        expect(providerRefusalReason(await thrownOf(service.cancel(CONNECTION, { linkId: "nope" }, undefined)))).toBe("not_found")
    })

    it("is deterministic: two fresh accounts answer the same", async () => {
        const run = async () => {
            const { service } = setup()
            return [await service.create(CONNECTION, REQUEST), await service.get(CONNECTION, { orderCode: 1780000000001 })]
        }
        expect(await run()).toEqual(await run())
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        expect(await thrownOf(service.create(LIVE_CONNECTION, REQUEST))).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        const off = sandboxServiceOff(ACCOUNT)
        expect(await thrownOf(new PayosSandboxPaymentLinkService(off.sandbox).create(CONNECTION, REQUEST))).toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has a catalogue of unique PAYOS-<n> ids; the paid case is payOS's webhook on its real route with its real body shape", async () => {
        const ids = PAYOS_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^PAYOS-\d+$/.test(id))).toBe(true)
        expect(PAYOS_SANDBOX_CATALOGUE.provider).toBe("payos")
        const inbound = PAYOS_SANDBOX_CATALOGUE.cases.flatMap((one) => (one.inbound === undefined ? [] : [one.inbound]))
        expect(inbound).toHaveLength(1)
        expect(inbound[0]?.path("conn-p")).toBe("api/connections/payos/conn-p")
        const { sandbox } = setup()
        const at = new Date("2026-11-14T03:00:00.000Z")
        const events = await sandbox.inbound(ACCOUNT, "PAYOS-3", inbound[0]!, { orderCode: 1780000000001 }, at)
        expect(events).toHaveLength(1)
        expect(events[0]?.body).toMatchObject({
            code: "00",
            success: true,
            data: { orderCode: 1780000000001, amount: 150000, paymentLinkId: "sbx-payos-link-000001", reference: expect.any(String) },
            signature: expect.any(String),
        })
        const outbound = PAYOS_SANDBOX_CATALOGUE.cases.filter((one) => one.operation !== undefined)
        expect(outbound.every((one) => ["create", "get", "cancel"].includes(one.operation ?? ""))).toBe(true)
        for (const operation of ["create", "get", "cancel"]) {
            expect(outbound.filter((one) => one.operation === operation && one.default === true)).toHaveLength(1)
        }
        expect(outbound.filter((one) => one.default === true).map((one) => one.id)).toEqual(["PAYOS-1", "PAYOS-4", "PAYOS-5"])
    })

    it("PAYOS-3: names the id and the amount of a link the account created, read from its state", async () => {
        const { sandbox, service } = setup()
        await service.create(CONNECTION, REQUEST)
        const second = await service.create(CONNECTION, { ...REQUEST, amountVnd: 99000 })
        const paid = PAYOS_SANDBOX_CATALOGUE.cases.find((one) => one.id === "PAYOS-3")?.inbound

        const events = await sandbox.inbound(ACCOUNT, "PAYOS-3", paid!, { orderCode: second.orderCode }, new Date("2026-11-14T03:00:00.000Z"))

        expect(events[0]?.body).toMatchObject({
            data: {
                orderCode: 1780000000002,
                amount: 99000,
                description: "DH001",
                paymentLinkId: "sbx-payos-link-000002",
                reference: "SBXPAYOS000001",
                transactionDateTime: "2026-11-14 10:00:00",
            },
        })
        const again = await sandbox.inbound(ACCOUNT, "PAYOS-3", paid!, { orderCode: second.orderCode }, new Date("2026-11-14T03:00:00.000Z"))
        expect(again[0]?.body).toMatchObject({ data: { reference: "SBXPAYOS000002" } })
        expect(paid?.inputs).toEqual([expect.objectContaining({ name: "orderCode", kind: "integer", example: 1780000000001 })])
    })

    it("reaches no network: one constructor argument, no integration import, no web address in the source", () => {
        expect(PayosSandboxPaymentLinkService.length).toBe(1)
        const source = fs.readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
