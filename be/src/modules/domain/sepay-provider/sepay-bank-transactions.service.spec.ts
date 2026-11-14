import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import type { ConnectionRecord } from "@modules/domain/connections"
import { SEPAY } from "@modules/integrations/sepay"
import type { SepayClient, SepayTransaction } from "@modules/integrations/sepay"
import { CLOCK } from "@modules/platform/clock"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"

const TOKEN = ["tok", "1"].join("-")

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

const REAL: SepayTransaction = {
    id: "95958515",
    occurredAt: new Date("2026-11-03T18:06:00.000Z"),
    amountIn: 5000,
    amountOut: 0,
    content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    code: null,
    bank: "MBBank",
}

const build = async () => {
    const sepay = mock<SepayClient>()
    const tokens = mock<ConnectionApiTokenService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayBankTransactionsService,
            { provide: SEPAY, useValue: sepay },
            { provide: ConnectionApiTokenService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(SepayBankTransactionsService), sepay, tokens }
}

describe("SepayBankTransactionsService transactions", () => {
    it("lists the account in the window the caller names and keeps the rows that moved money", async () => {
        const { service, sepay, tokens } = await build()
        tokens.read.mockResolvedValue(TOKEN)
        sepay.listTransactions.mockResolvedValue([REAL, { ...REAL, id: "1", amountIn: 0 }])
        const since = new Date("2026-11-01T00:00:00.000Z")
        const until = new Date("2026-11-04T00:00:00.000Z")

        const rows = await service.transactions(record({ account_number: "525209999" }), { since, until, limit: 20 })

        expect(sepay.listTransactions).toHaveBeenCalledWith(TOKEN, {
            accountNumber: "525209999",
            from: since,
            to: until,
            limit: 20,
        })
        expect(rows).toEqual([expect.objectContaining({ id: "sepay:95958515", direction: "credit", amountVnd: 5000 })])
    })

    it("reads the last seven days when the caller names no start", async () => {
        const { service, sepay, tokens } = await build()
        tokens.read.mockResolvedValue(TOKEN)
        sepay.listTransactions.mockResolvedValue([])

        await expect(
            service.transactions(record({ account_number: "1" }), { since: undefined, until: undefined, limit: 5 }),
        ).resolves.toEqual([])

        expect(sepay.listTransactions).toHaveBeenCalledWith(TOKEN, {
            accountNumber: "1",
            from: new Date("2026-10-28T10:00:00.000Z"),
            to: undefined,
            limit: 5,
        })
    })

    it.each([
        ["no full account number", {}, TOKEN],
        ["no API token", { account_number: "1" }, null],
    ])("cannot be read with %s", async (_name, meta, token) => {
        const { service, sepay, tokens } = await build()
        tokens.read.mockResolvedValue(token)

        await expect(
            service.transactions(record(meta), { since: undefined, until: undefined, limit: 5 }),
        ).resolves.toBeUndefined()
        expect(sepay.listTransactions).not.toHaveBeenCalled()
    })
})
