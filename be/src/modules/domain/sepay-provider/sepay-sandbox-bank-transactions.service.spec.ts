import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { seedSepayMovements } from "@tests/fixtures/builders/sepay-sandbox.builder"
import { SepaySandboxBankTransactionsService } from "./sepay-sandbox-bank-transactions.service"

const ACCOUNT = sandboxAccount({ id: "conn-s", workspaceId: "ws-1", provider: "sepay" })
const CONNECTION = connectionRecord({ id: "conn-s", workspaceId: "ws-1", provider: "sepay", sandbox: true })

/** The service over an account whose inbound cases made five movements (the seed), the empty one when `empty`. */
const setup = async (empty = false) => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    if (!empty) await seedSepayMovements(sandbox, ACCOUNT)
    return { sandbox, service: new SepaySandboxBankTransactionsService(sandbox) }
}

describe("SepaySandboxBankTransactionsService", () => {
    it("lists the movements the account's cases made, newest first in the bank-feed shape, a debit as a debit", async () => {
        const { service } = await setup()

        const list = await service.transactions(CONNECTION, { since: undefined, until: undefined, limit: 50 })

        expect(list?.map((one) => one.id)).toEqual(["sepay:9100005", "sepay:9100004", "sepay:9100003", "sepay:9100002", "sepay:9100001"])
        expect(list?.[0]).toEqual({
            id: "sepay:9100005",
            direction: "credit",
            amountVnd: 450000,
            content: "NIVO DH1003",
            occurredAt: "2026-11-14T04:12:51.000Z",
            bankName: "Vietcombank",
        })
        expect(list?.[1]).toMatchObject({ direction: "debit", amountVnd: 80000 })
    })

    it("honours since, until and limit", async () => {
        const { service } = await setup()

        const window = await service.transactions(CONNECTION, {
            since: new Date("2026-11-14T02:30:00.000Z"),
            until: new Date("2026-11-14T03:10:00.000Z"),
            limit: 50,
        })
        const limited = await service.transactions(CONNECTION, { since: undefined, until: undefined, limit: 1 })

        expect(window?.map((one) => one.id)).toEqual(["sepay:9100003", "sepay:9100002"])
        expect(limited).toHaveLength(1)
    })

    it("logs exactly one call per request and answers the same every time", async () => {
        const { sandbox, service } = await setup()
        const query = { since: undefined, until: undefined, limit: 50 }

        expect(await service.transactions(CONNECTION, query)).toEqual(await service.transactions(CONNECTION, query))
        expect(await sandbox.calls(ACCOUNT, "transactions")).toHaveLength(2)
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = await setup()
        const off = new SepaySandboxBankTransactionsService(sandboxServiceOff(ACCOUNT).sandbox)
        const query = { since: undefined, until: undefined, limit: 5 }

        await expect(service.transactions({ ...CONNECTION, sandbox: false }, query)).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
        await expect(off.transactions(CONNECTION, query)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(SepaySandboxBankTransactionsService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
