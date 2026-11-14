import { mock } from "@starci/jest-preset"
import type { ConnectionSecretReadsService } from "@modules/domain/connections"
import { proofOf, providerCallFailure, providerRefusalDetail, providerRefusalReason, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { PAYOS_OPS, PayosError, PayosErrorCode } from "@modules/integrations/payos"
import type { PayosClient } from "@modules/integrations/payos"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { OrderCodesPolicy } from "./payos-order-code.policy"
import { PayosPaymentLinkService } from "./payos-payment-link.service"

const CONNECTION = connectionRecord({ id: "conn-1", workspaceId: "ws-1", provider: "payos", meta: {} })
const CREDENTIAL = JSON.stringify({ clientId: "client-1", apiKey: "key-1", checksumKey: "checksum-1" })
const KEYS = { clientId: "client-1", apiKey: "key-1", checksumKey: "checksum-1" }

// Handwritten from the member names of https://payos.vn/docs/api/ (create, get and cancel a payment link).
const CREATED = {
    bin: "970422",
    accountNumber: "12345678",
    accountName: "TIEM HOA",
    amount: 150000,
    description: "DH001",
    orderCode: 1789000000001,
    currency: "VND",
    paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
    status: "PENDING",
    checkoutUrl: "https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18",
    qrCode: "00020101021238570010A000000727",
}
const INFO = {
    id: "124c33293c43417ab7879e14c8d9eb18",
    orderCode: 1789000000001,
    amount: 150000,
    amountPaid: 0,
    amountRemaining: 150000,
    status: "PENDING",
    createdAt: "2026-11-13T10:00:00+07:00",
    transactions: [],
}
const REQUEST = {
    amountVnd: 150000,
    description: "DH001",
    returnUrl: "https://shop.example/paid",
    cancelUrl: "https://shop.example/cancelled",
}

const build = (options: { readonly credential?: string | null; readonly now?: number } = {}) => {
    const client = mock<PayosClient>()
    const secrets = mock<ConnectionSecretReadsService>()
    const credential = options.credential === undefined ? CREDENTIAL : options.credential
    secrets.secretOf.mockResolvedValue(
        credential === null
            ? ({ kind: "refused", code: "x" } as never)
            : ({ kind: "ok", value: { workspaceId: "ws-1", credential, webhookSecret: "" } } as never),
    )
    jest.spyOn(Date, "now").mockReturnValue(options.now ?? 1789000000001)
    const service = new PayosPaymentLinkService(client, secrets, new OrderCodesPolicy())
    return { service, client, secrets }
}

const failure = (work: Promise<unknown>): Promise<unknown> =>
    Promise.resolve(work.then(
        () => null,
        (cause: unknown) => cause,
    ))

describe("PayosPaymentLinkService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("answers for the payos provider key", () => {
        expect(build().service.provider).toBe("payos")
    })

    describe("create", () => {
        it("sends orderCode (generated), amount, description, returnUrl, cancelUrl under the connection's three keys; answers the documented members", async () => {
            const { service, client, secrets } = build()
            client.call.mockResolvedValue(CREATED)

            const link = await service.create(CONNECTION, REQUEST)

            expect(secrets.secretOf).toHaveBeenCalledWith("conn-1", "payos")
            expect(client.call).toHaveBeenCalledWith(KEYS, PAYOS_OPS.createLink, {
                body: {
                    orderCode: 1789000000001,
                    amount: 150000,
                    description: "DH001",
                    returnUrl: "https://shop.example/paid",
                    cancelUrl: "https://shop.example/cancelled",
                },
            })
            expect(link).toEqual({
                linkId: "124c33293c43417ab7879e14c8d9eb18",
                orderCode: 1789000000001,
                checkoutUrl: "https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18",
                qrPayload: "00020101021238570010A000000727",
                amountVnd: 150000,
                description: "DH001",
                status: "PENDING",
            })
        })

        it("sends expiredAt as a Unix timestamp in seconds and echoes the instant asked", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue(CREATED)

            const link = await service.create(CONNECTION, { ...REQUEST, expiresAt: "2026-11-13T10:30:00.000Z" })

            const expiredAt = Date.parse("2026-11-13T10:30:00.000Z") / 1000
            expect(client.call).toHaveBeenCalledWith(KEYS, PAYOS_OPS.createLink, { body: expect.objectContaining({ expiredAt }) })
            expect(link.expiresAt).toBe("2026-11-13T10:30:00.000Z")
        })

        it("never sends an instant that does not fit the documented Int32 timestamp: refused rejected, nothing sent", async () => {
            const { service, client } = build()

            const cause = await failure(service.create(CONNECTION, { ...REQUEST, expiresAt: "2100-01-01T00:00:00.000Z" }))

            expect(cause).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
            expect(client.call).not.toHaveBeenCalled()
        })

        it("takes a fresh order code for every call (the adapter is called once per tool key; a second call is a new link)", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue(CREATED)

            await service.create(CONNECTION, REQUEST)
            await service.create(CONNECTION, REQUEST)

            const codes = client.call.mock.calls.map(([, , call]) => (call.body as { orderCode: number }).orderCode)
            expect(codes).toEqual([1789000000001, 1789000000002])
        })

        it("refuses no_credential, sending nothing, when the connection has no readable secret or lacks one of the three keys", async () => {
            for (const credential of [null, "not json", JSON.stringify({ clientId: "c", apiKey: "k" }), JSON.stringify({ clientId: "c", apiKey: "", checksumKey: "s" })]) {
                const { service, client } = build({ credential })

                const cause = await failure(service.create(CONNECTION, REQUEST))

                expect(providerRefusalReason(cause)).toBe("no_credential")
                expect(client.call).not.toHaveBeenCalled()
            }
        })

        it.each([
            ["a refusal as asked is rejected, with payOS's words", new PayosError({ code: PayosErrorCode.Rejected, params: { reason: "20: bad" } }), "rejected"],
            ["a refused key is auth_refused", new PayosError({ code: PayosErrorCode.AuthFailed, params: { reason: "401" } }), "auth_refused"],
        ])("%s", async (_name, error, reason) => {
            const { service, client } = build()
            client.call.mockRejectedValue(error)

            const cause = await failure(service.create(CONNECTION, REQUEST))

            expect(providerRefusalReason(cause)).toBe(reason)
        })

        it("carries payOS's words of a refusal as the detail", async () => {
            const { service, client } = build()
            client.call.mockRejectedValue(new PayosError({ code: PayosErrorCode.Rejected, params: { reason: "20: bad" } }))

            expect(providerRefusalDetail(await failure(service.create(CONNECTION, REQUEST)))).toBe("20: bad")
        })

        it("proves not_sent for a 429 (refused at the gateway) and unknown for a timeout, a 5xx or an unreadable answer (a signed POST that may have left)", async () => {
            const cases: ReadonlyArray<readonly [PayosErrorCode, "not_sent" | "unknown"]> = [
                [PayosErrorCode.RateLimited, "not_sent"],
                [PayosErrorCode.Unreachable, "unknown"],
                [PayosErrorCode.Failed, "unknown"],
            ]
            for (const [code, proof] of cases) {
                const { service, client } = build()
                client.call.mockRejectedValue(new PayosError({ code }))

                expect(proofOf(await failure(service.create(CONNECTION, REQUEST)))).toBe(proof)
            }
        })

        it("proves unknown when payOS answered 2xx with data that cannot be read (the link may exist)", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue({ ...CREATED, checkoutUrl: undefined })

            const cause = await failure(service.create(CONNECTION, REQUEST))

            expect(proofOf(cause)).toBe("unknown")
            expect(providerRefusalReason(cause)).toBeNull()
        })

        it("types any other failure as unknown", async () => {
            const { service, client } = build()
            client.call.mockRejectedValue(new Error("boom"))

            const cause = await failure(service.create(CONNECTION, REQUEST))

            expect(proofOf(cause)).toBe("unknown")
        })
    })

    describe("get", () => {
        it("reads by the link id as the path id, answering the documented members", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue(INFO)

            const state = await service.get(CONNECTION, { linkId: "124c33293c43417ab7879e14c8d9eb18" })

            expect(client.call).toHaveBeenCalledWith(KEYS, PAYOS_OPS.getLink, { path: { id: "124c33293c43417ab7879e14c8d9eb18" } })
            expect(state).toEqual({
                linkId: "124c33293c43417ab7879e14c8d9eb18",
                orderCode: 1789000000001,
                amountVnd: 150000,
                amountPaidVnd: 0,
                amountRemainingVnd: 150000,
                status: "PENDING",
                createdAt: "2026-11-13T10:00:00+07:00",
            })
        })

        it("reads by the order code as the path id", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue(INFO)

            await service.get(CONNECTION, { orderCode: 1789000000001 })

            expect(client.call).toHaveBeenCalledWith(KEYS, PAYOS_OPS.getLink, { path: { id: "1789000000001" } })
        })

        it("refuses not_found for a link payOS does not hold", async () => {
            const { service, client } = build()
            client.call.mockRejectedValue(new PayosError({ code: PayosErrorCode.NotFound }))

            expect(providerRefusalReason(await failure(service.get(CONNECTION, { orderCode: 5 })))).toBe("not_found")
        })
    })

    describe("cancel", () => {
        it("posts the cancel with the optional reason and answers the cancelled state", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue({ ...INFO, status: "CANCELLED", canceledAt: "2026-11-13T10:05:00+07:00", cancellationReason: "Changed my mind" })

            const state = await service.cancel(CONNECTION, { linkId: "124c33293c43417ab7879e14c8d9eb18" }, "Changed my mind")

            expect(client.call).toHaveBeenCalledWith(KEYS, PAYOS_OPS.cancelLink, {
                path: { id: "124c33293c43417ab7879e14c8d9eb18" },
                body: { cancellationReason: "Changed my mind" },
            })
            expect(state).toMatchObject({ status: "CANCELLED", canceledAt: "2026-11-13T10:05:00+07:00", cancellationReason: "Changed my mind" })
        })

        it("sends an empty body when no reason is given", async () => {
            const { service, client } = build()
            client.call.mockResolvedValue({ ...INFO, status: "CANCELLED" })

            await service.cancel(CONNECTION, { orderCode: 7 }, undefined)

            expect(client.call).toHaveBeenCalledWith(KEYS, PAYOS_OPS.cancelLink, { path: { id: "7" }, body: {} })
        })

        it("proves unknown for a timeout of the cancel POST", async () => {
            const { service, client } = build()
            client.call.mockRejectedValue(new PayosError({ code: PayosErrorCode.Unreachable }))

            expect(proofOf(await failure(service.cancel(CONNECTION, { orderCode: 7 }, undefined)))).toBe("unknown")
            expect(providerCallFailure("unknown")).toMatchObject({ code: ProviderRegistryErrorCode.CallUnknown })
        })
    })
})
