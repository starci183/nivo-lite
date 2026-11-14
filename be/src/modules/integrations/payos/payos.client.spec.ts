import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode, type HttpClient } from "@modules/platform/http"
import { PayosErrorCode } from "./errors/payos.error"
import {
    PayosClient,
    payosCancelledOf,
    payosCreatedOf,
    payosDataOf,
    payosInfoOf,
    payosRequestOf,
    payosSignatureOf,
} from "./payos.client"
import { PAYOS_OPS } from "./payos.operations"
import { PAYOS_OPTIONS } from "./payos.decorators"
import type { PayosOptions } from "./payos.options"

const options: PayosOptions = { apiBase: "https://api-merchant.payos.vn", timeoutMs: 4000 }
const CREDENTIAL = { clientId: "client-1", apiKey: "key-1", checksumKey: "checksum-1" }

/** The create-link input of a handwritten order (member names from https://payos.vn/docs/api/ , POST /v2/payment-requests). */
const INPUT = {
    orderCode: 1789000000001,
    amount: 3000,
    description: "DH001",
    returnUrl: "https://shop.example/paid",
    cancelUrl: "https://shop.example/cancelled",
}

const SIGNED_FIELDS = {
    amount: 3000,
    cancelUrl: INPUT.cancelUrl,
    description: "DH001",
    orderCode: INPUT.orderCode,
    returnUrl: INPUT.returnUrl,
}

describe("payosSignatureOf (https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/)", () => {
    it("matches the documented test vector: the data object sorted by key, key=value joined with &, HMAC-SHA256 hex under the checksum key", () => {
        // The documented sample data, its checksum key and its expected signature, all from that page.
        const data = {
            orderCode: 123,
            amount: 3000,
            description: "VQRIO123",
            accountNumber: "12345678",
            reference: "TF230204212323",
            transactionDateTime: "2023-02-04 18:25:00",
            currency: "VND",
            paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
            code: "00",
            desc: "Th\u00E0nh c\u00F4ng",
            counterAccountBankId: "",
            counterAccountBankName: "",
            counterAccountName: "",
            counterAccountNumber: "",
            virtualAccountName: "",
            virtualAccountNumber: "",
        }

        expect(payosSignatureOf(data, "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675")).toBe(
            "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03",
        )
    })

    it("turns a null or undefined member into an empty value, as the page's samples do", () => {
        expect(payosSignatureOf({ a: null, b: undefined, c: "x" }, "k")).toBe(payosSignatureOf({ a: "", b: "", c: "x" }, "k"))
    })
})

describe("payosRequestOf (https://payos.vn/docs/api/ : create, get, cancel a payment link)", () => {
    it("create: POST /v2/payment-requests with x-client-id / x-api-key and the five-field signature (amount, cancelUrl, description, orderCode, returnUrl)", () => {
        const request = payosRequestOf(options, CREDENTIAL, PAYOS_OPS.createLink, { body: INPUT })

        expect(request.method).toBe("POST")
        expect(request.url).toBe("https://api-merchant.payos.vn/v2/payment-requests")
        expect(request.headers).toEqual({ "x-client-id": "client-1", "x-api-key": "key-1" })
        expect(request.timeoutMs).toBe(4000)
        expect(request.body).toEqual({ ...INPUT, signature: payosSignatureOf(SIGNED_FIELDS, "checksum-1") })
    })

    it("create: signs the five fields only; expiredAt rides in the body unsigned", () => {
        const request = payosRequestOf(options, CREDENTIAL, PAYOS_OPS.createLink, { body: { ...INPUT, expiredAt: 1789000600 } })
        expect(request.body).toMatchObject({ expiredAt: 1789000600, signature: payosSignatureOf(SIGNED_FIELDS, "checksum-1") })
    })

    it("get: GET /v2/payment-requests/{id} (an order code or a link id), no body", () => {
        const request = payosRequestOf(options, CREDENTIAL, PAYOS_OPS.getLink, { path: { id: "3019" } })

        expect(request).toEqual({
            method: "GET",
            url: "https://api-merchant.payos.vn/v2/payment-requests/3019",
            headers: { "x-client-id": "client-1", "x-api-key": "key-1" },
            timeoutMs: 4000,
        })
    })

    it("cancel: POST /v2/payment-requests/{id}/cancel with the optional cancellationReason", () => {
        const request = payosRequestOf(options, CREDENTIAL, PAYOS_OPS.cancelLink, {
            path: { id: "124c33293c43417ab7879e14c8d9eb18" },
            body: { cancellationReason: "Changed my mind" },
        })

        expect(request.method).toBe("POST")
        expect(request.url).toBe("https://api-merchant.payos.vn/v2/payment-requests/124c33293c43417ab7879e14c8d9eb18/cancel")
        expect(request.body).toEqual({ cancellationReason: "Changed my mind" })
    })

    it("encodes a path value", () => {
        expect(payosRequestOf(options, CREDENTIAL, PAYOS_OPS.getLink, { path: { id: "a/b" } }).url).toBe(
            "https://api-merchant.payos.vn/v2/payment-requests/a%2Fb",
        )
    })

    it("names every operation by its method and path", () => {
        expect(Object.values(PAYOS_OPS).map((operation) => `${operation.method} ${operation.path}`)).toEqual([
            "POST /v2/payment-requests",
            "GET /v2/payment-requests/{id}",
            "POST /v2/payment-requests/{id}/cancel",
        ])
    })
})

const ENVELOPE = { code: "00", desc: "success", signature: "s" }

describe("payosDataOf, the data of an answer or the typed failure", () => {
    it("answers data of a 2xx with code 00", () => {
        expect(payosDataOf({ status: 200, body: { ...ENVELOPE, data: { orderCode: 1 } } })).toEqual({ orderCode: 1 })
    })

    it.each([
        ["429 slow down", { status: 429, body: {} }, PayosErrorCode.RateLimited],
        ["401 the key (the docs file every error under 401, so its words ride along)", { status: 401, body: { code: "401", desc: "x" } }, PayosErrorCode.AuthFailed],
        ["403 the key", { status: 403, body: {} }, PayosErrorCode.AuthFailed],
        ["404 no such link", { status: 404, body: {} }, PayosErrorCode.NotFound],
        ["another 4xx, refused as asked", { status: 400, body: { code: "20", desc: "bad" } }, PayosErrorCode.Rejected],
        ["a 2xx whose code is not 00", { status: 200, body: { code: "20", desc: "bad", data: null } }, PayosErrorCode.Rejected],
        ["a 5xx", { status: 502, body: {} }, PayosErrorCode.Failed],
        ["a 2xx that is no JSON object", { status: 200, body: "ok" }, PayosErrorCode.Failed],
        ["a 2xx without data", { status: 200, body: { ...ENVELOPE } }, PayosErrorCode.Failed],
    ])("%s", (_name, answer, code) => {
        expect(() => payosDataOf(answer)).toThrow(expect.objectContaining({ code }))
    })

    it("carries the provider's own code and words of a refusal, cut", () => {
        expect(() => payosDataOf({ status: 200, body: { code: "20", desc: "d".repeat(500), data: null } })).toThrow(
            expect.objectContaining({ params: expect.objectContaining({ reason: expect.stringMatching(/^20: ddd.{0,303}$/) }) }),
        )
    })
})

describe("the readings of the documented answers", () => {
    const CREATED = {
        bin: "970422",
        accountNumber: "12345678",
        accountName: "TIEM HOA",
        amount: 3000,
        description: "DH001",
        orderCode: 1789000000001,
        currency: "VND",
        paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
        status: "PENDING",
        checkoutUrl: "https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18",
        qrCode: "00020101021238570010A000000727",
    }

    it("create: paymentLinkId, orderCode, checkoutUrl, qrCode, amount, description, status", () => {
        expect(payosCreatedOf(CREATED)).toEqual({
            paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
            orderCode: 1789000000001,
            checkoutUrl: "https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18",
            qrCode: "00020101021238570010A000000727",
            amount: 3000,
            description: "DH001",
            status: "PENDING",
        })
    })

    it("create: an answer without a link id, order code, checkout address, amount or status is unreadable", () => {
        for (const member of ["paymentLinkId", "orderCode", "checkoutUrl", "amount", "status"]) {
            const broken = { ...CREATED, [member]: undefined }
            expect(() => payosCreatedOf(broken)).toThrow(expect.objectContaining({ code: PayosErrorCode.Failed }))
        }
    })

    it("create: qrCode is optional", () => {
        expect(payosCreatedOf({ ...CREATED, qrCode: undefined }).qrCode).toBeNull()
    })

    const INFO = {
        id: "124c33293c43417ab7879e14c8d9eb18",
        orderCode: 3019,
        amount: 3000,
        amountPaid: 0,
        amountRemaining: 3000,
        status: "PENDING",
        createdAt: "2026-11-13T10:00:00+07:00",
        transactions: [],
    }

    it("get: id, orderCode, amount, amountPaid, amountRemaining, status, createdAt", () => {
        expect(payosInfoOf(INFO)).toEqual({
            id: "124c33293c43417ab7879e14c8d9eb18",
            orderCode: 3019,
            amount: 3000,
            amountPaid: 0,
            amountRemaining: 3000,
            status: "PENDING",
            createdAt: "2026-11-13T10:00:00+07:00",
            canceledAt: null,
            cancellationReason: null,
        })
    })

    it("cancel: adds canceledAt and cancellationReason", () => {
        expect(
            payosCancelledOf({ ...INFO, status: "CANCELLED", canceledAt: "2026-11-13T10:05:00+07:00", cancellationReason: "Changed my mind" }),
        ).toMatchObject({ status: "CANCELLED", canceledAt: "2026-11-13T10:05:00+07:00", cancellationReason: "Changed my mind" })
    })

    it("get: an answer without id, orderCode, amount or status is unreadable", () => {
        for (const member of ["id", "orderCode", "status", "amount"]) {
            expect(() => payosInfoOf({ ...INFO, [member]: undefined })).toThrow(expect.objectContaining({ code: PayosErrorCode.Failed }))
        }
    })
})

describe("PayosClient", () => {
    const build = async (http: HttpClient) => {
        const moduleRef = await Test.createTestingModule({
            providers: [PayosClient, { provide: HTTP_CLIENT, useValue: http }, { provide: PAYOS_OPTIONS, useValue: options }],
        }).compile()
        return moduleRef.get(PayosClient)
    }

    it("sends the built request and answers the data", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValue({ status: 200, body: { ...ENVELOPE, data: { orderCode: 1 } } })

        await expect((await build(http)).call(CREDENTIAL, PAYOS_OPS.getLink, { path: { id: "1" } })).resolves.toEqual({ orderCode: 1 })
        expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url: "https://api-merchant.payos.vn/v2/payment-requests/1" }))
    })

    it("types a network failure or a timeout as unreachable (the request may have left)", async () => {
        const http = mock<HttpClient>()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Timeout }))

        await expect((await build(http)).call(CREDENTIAL, PAYOS_OPS.createLink, { body: INPUT })).rejects.toMatchObject({ code: PayosErrorCode.Unreachable })
    })
})
