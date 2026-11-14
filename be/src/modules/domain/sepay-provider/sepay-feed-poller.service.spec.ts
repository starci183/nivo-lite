import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord } from "@modules/domain/connections"
import { SEPAY, SepayError, SepayErrorCode } from "@modules/integrations/sepay"
import type { SepayClient, SepayTransaction } from "@modules/integrations/sepay"
import { SepayFeedPollerService } from "./sepay-feed-poller.service"

const TOKEN = ["tok", "1"].join("-")
const WINDOW = { from: new Date("2026-10-28T00:00:00.000Z"), to: undefined, limit: 200 }

const record = (meta: Record<string, string>): ConnectionRecord => ({
    id: "conn-1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "SePay",
    meta,
    status: "connected",
    lastError: null,
    environment: "live",
    sandbox: false,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-03T00:00:00.000Z",
})

const row = (id: string, at: string, amountIn: number): SepayTransaction => ({
    id,
    occurredAt: new Date(at),
    amountIn,
    amountOut: 0,
    content: "BUI NGUYEN DINH",
    code: null,
    bank: "MBBank",
})

const build = async () => {
    const sepay = mock<SepayClient>()
    const tokens = mock<ConnectionApiTokenService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayFeedPollerService,
            { provide: SEPAY, useValue: sepay },
            { provide: ConnectionApiTokenService, useValue: tokens },
        ],
    }).compile()
    return { poller: moduleRef.get(SepayFeedPollerService), sepay, tokens }
}

describe("SepayFeedPollerService fetch", () => {
    it("lists the account with the connection token and keeps the rows that moved money, with the page bounds of all rows", async () => {
        const { poller, sepay, tokens } = await build()
        tokens.read.mockResolvedValue(TOKEN)
        sepay.listTransactions.mockResolvedValue([
            row("95958515", "2026-11-03T18:06:00.000Z", 5000),
            row("95958000", "2026-11-03T17:00:00.000Z", 0),
        ])

        const page = await poller.fetch(record({ account_number: "525209999" }), WINDOW)

        expect(sepay.listTransactions).toHaveBeenCalledWith(TOKEN, { accountNumber: "525209999", ...WINDOW })
        expect(page).toMatchObject({
            kind: "page",
            fetched: 2,
            oldestAt: new Date("2026-11-03T17:00:00.000Z"),
            newestAt: new Date("2026-11-03T18:06:00.000Z"),
        })
        expect(page.kind === "page" ? page.items.map((item) => item.deliveryId) : []).toEqual(["conn-1:sepay:95958515"])
    })

    it("reads an empty list as an empty page", async () => {
        const { poller, sepay, tokens } = await build()
        tokens.read.mockResolvedValue(TOKEN)
        sepay.listTransactions.mockResolvedValue([])

        await expect(poller.fetch(record({ account_number: "1" }), WINDOW)).resolves.toEqual({
            kind: "page",
            items: [],
            fetched: 0,
            oldestAt: undefined,
            newestAt: undefined,
        })
    })

    it("leaves a connection without the full account number out", async () => {
        const { poller, sepay } = await build()

        await expect(poller.fetch(record({}), WINDOW)).resolves.toEqual({ kind: "skipped", reason: "no_account" })
        expect(sepay.listTransactions).not.toHaveBeenCalled()
    })

    it("leaves a connection without an API token out", async () => {
        const { poller, sepay, tokens } = await build()
        tokens.read.mockResolvedValue(null)

        await expect(poller.fetch(record({ account_number: "1" }), WINDOW)).resolves.toEqual({
            kind: "skipped",
            reason: "no_token",
        })
        expect(sepay.listTransactions).not.toHaveBeenCalled()
    })
})

describe("SepayFeedPollerService limits and classification", () => {
    it("declares conservative limits for one credential", async () => {
        const { poller } = await build()

        expect(poller.limits).toEqual({ ratePerSecond: 2, burst: 2, concurrency: 1 })
    })

    it.each([
        [
            "asked to slow down with a wait",
            new SepayError({ code: SepayErrorCode.RateLimited, params: { retryAfterSeconds: 7 } }),
            { kind: "rate_limited", retryAfterSeconds: 7 },
        ],
        [
            "asked to slow down with no wait",
            new SepayError({ code: SepayErrorCode.RateLimited }),
            { kind: "rate_limited", retryAfterSeconds: 0 },
        ],
        ["a refused token", new SepayError({ code: SepayErrorCode.AuthFailed }), { kind: "auth_failed" }],
        ["an unreachable API", new SepayError({ code: SepayErrorCode.Unavailable }), { kind: "transient" }],
        ["a refusal retrying cannot change", new SepayError({ code: SepayErrorCode.Rejected }), { kind: "fatal" }],
        ["an error that is not SePay", new Error("boom"), { kind: "fatal" }],
    ])("classifies %s", async (_name, error, expected) => {
        const { poller } = await build()

        expect(poller.classify(error)).toEqual(expected)
    })
})
