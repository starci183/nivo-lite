import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { SepayErrorCode } from "./errors/sepay.error"
import { SepayClient, toSepayTime } from "./sepay.client"
import { SEPAY_OPTIONS } from "./sepay.decorators"
import type { SepayOptions } from "./sepay.options"

const options: SepayOptions = { apiBase: "https://sepay.test", timeoutMs: 4000 }
const TOKEN = ["tok", "1"].join("-")
const FROM = new Date("2026-11-03T00:00:00.000Z")
const TO = new Date("2026-11-04T10:00:00.000Z")
const QUERY = { accountNumber: "1", from: FROM, limit: 5 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: SEPAY_OPTIONS, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(SepayClient), http }
}

const row = (extra: Record<string, unknown> = {}) => ({
    id: "92704",
    bank_brand_name: "MBBank",
    account_number: "0123456789",
    transaction_date: "2026-11-04 00:50:12",
    amount_out: "0.00",
    amount_in: "5000.00",
    transaction_content: " BUI NGUYEN DINH chuyen tien ",
    code: null,
    ...extra,
})

describe("toSepayTime", () => {
    it("prints an instant in Vietnam time", () => {
        expect(toSepayTime(new Date("2026-11-03T17:50:12.000Z"))).toBe("2026-11-04 00:50:12")
    })
})

describe("SepayClient listTransactions", () => {
    it("asks for the account in the window with the bearer token and maps the rows", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { status: 200, transactions: [row()] } })

        const rows = await client.listTransactions(TOKEN, {
            accountNumber: "0123456789",
            from: FROM,
            to: TO,
            limit: 50,
        })

        expect(rows).toEqual([
            {
                id: "92704",
                occurredAt: new Date("2026-11-03T17:50:12.000Z"),
                amountIn: 5000,
                amountOut: 0,
                content: "BUI NGUYEN DINH chuyen tien",
                code: null,
                bank: "MBBank",
            },
        ])
        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: "https://sepay.test/userapi/transactions/list?account_number=0123456789&transaction_date_min=2026-11-03+07%3A00%3A00&limit=50&transaction_date_max=2026-11-04+17%3A00%3A00",
            headers: { Authorization: `Bearer ${TOKEN}` },
            timeoutMs: 4000,
        })
    })

    it("leaves the upper bound out when none is given and reads numeric ids and amounts", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({
            status: 200,
            body: { transactions: [row({ id: 7, amount_in: 0, amount_out: 120, code: "DH1", bank_brand_name: " " })] },
        })

        const [only] = await client.listTransactions(TOKEN, QUERY)

        expect(only).toMatchObject({ id: "7", amountIn: 0, amountOut: 120, code: "DH1", bank: null })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: expect.not.stringContaining("transaction_date_max") }),
        )
    })

    it("reads an unreadable amount as no money", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({
            status: 200,
            body: { transactions: [row({ amount_in: "abc", amount_out: Number.NaN, transaction_content: undefined })] },
        })

        const [only] = await client.listTransactions(TOKEN, QUERY)

        expect(only).toMatchObject({ amountIn: 0, amountOut: 0, content: "" })
    })

    it.each([
        ["a row that is not an object", "text"],
        ["a row without an id", row({ id: null })],
        ["a row without a time", row({ transaction_date: undefined })],
        ["a row with an unreadable time", row({ transaction_date: "yesterday" })],
    ])("refuses %s instead of skipping the transfer", async (_name, bad) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { transactions: [bad] } })

        await expect(client.listTransactions(TOKEN, QUERY)).rejects.toMatchObject({
            code: SepayErrorCode.Rejected,
            params: { reason: "malformed transaction" },
        })
    })

    it.each([
        [401, SepayErrorCode.Rejected],
        [500, SepayErrorCode.Unavailable],
        [429, SepayErrorCode.RateLimited],
    ])("answers status %i with %s", async (status, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body: {} })

        await expect(client.listTransactions(TOKEN, QUERY)).rejects.toMatchObject({ code })
    })

    it.each([
        ["a body that is not an object", "oops"],
        ["a body without transactions", { status: 200 }],
    ])("is unavailable on %s", async (_name, body) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body })

        await expect(client.listTransactions(TOKEN, QUERY)).rejects.toMatchObject({ code: SepayErrorCode.Unavailable })
    })

    it("is unavailable when the network fails", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new Error("socket hang up"))

        await expect(client.listTransactions(TOKEN, QUERY)).rejects.toMatchObject({ code: SepayErrorCode.Unavailable })
    })
})
