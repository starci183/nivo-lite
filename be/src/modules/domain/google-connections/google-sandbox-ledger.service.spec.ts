import { readFileSync } from "node:fs"
import { ProviderRegistryErrorCode, proofOf, type BusinessLedgerEntry } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { GOOGLE_LEDGER_CASE, GOOGLE_LEDGER_SANDBOX_CATALOGUE } from "./google-sandbox.catalogue"
import { GoogleSandboxLedgerService } from "./google-sandbox-ledger.service"

const build = () => {
    const account = sandboxAccount({ provider: "google" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "google", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, ledger: new GoogleSandboxLedgerService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const entry = (transactionId: string): BusinessLedgerEntry => ({
    date: "2026-11-14",
    orderNo: "DH-001",
    customer: "Dinh",
    amountVnd: 250000,
    transactionId,
    status: "paid",
    note: "",
})

describe("GoogleSandboxLedgerService", () => {
    it("GOOGLE-LEDGER-1 (default): a sandbox account is ready", async () => {
        const { ledger, connection } = build()

        await expect(ledger.ready(connection)).resolves.toBe(true)
    })

    it("GOOGLE-LEDGER-2: the account picked not ready answers false, sticky", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "ready", GOOGLE_LEDGER_CASE.notReady)

        await expect(ledger.ready(connection)).resolves.toBe(false)
        await expect(ledger.ready(connection)).resolves.toBe(false)
    })

    it("GOOGLE-LEDGER-3 (default): appends rows after the header, answering the range of each, and repeats append again", async () => {
        const { ledger, connection } = build()

        await expect(ledger.append(connection, entry("TX-1"))).resolves.toBe("Sheet1!A2:H2")
        await expect(ledger.append(connection, entry("TX-2"))).resolves.toBe("Sheet1!A3:H3")
        await expect(ledger.append(connection, entry("TX-1"))).resolves.toBe("Sheet1!A4:H4")
    })

    it("GOOGLE-LEDGER-4: a refused sheet is the refused ledger connection of google, and no row is taken", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "append", GOOGLE_LEDGER_CASE.appendRefused)

        const error = await failure(ledger.append(connection, entry("TX-1")))

        expect(error).toMatchObject({ code: ProviderRegistryErrorCode.LedgerConnectionRefused, params: { provider: "google" } })
        await sandbox.setNextCase(account, "append", GOOGLE_LEDGER_CASE.appended)
        await expect(ledger.append(connection, entry("TX-2"))).resolves.toBe("Sheet1!A2:H2")
    })

    it("GOOGLE-LEDGER-5: no answer is the unknown-outcome failure and no row is taken", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "append", GOOGLE_LEDGER_CASE.appendNoAnswer)

        const error = await failure(ledger.append(connection, entry("TX-1")))

        expect(error).toMatchObject({ code: ProviderRegistryErrorCode.CallUnknown })
        expect(proofOf(error)).toBe("unknown")
    })

    it("GOOGLE-LEDGER-6: a failure before Google is a call failure proved not sent", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "append", GOOGLE_LEDGER_CASE.appendFailed)

        const error = await failure(ledger.append(connection, entry("TX-1")))

        expect(error).toMatchObject({ code: ProviderRegistryErrorCode.CallNotSent })
        expect(proofOf(error)).toBe("not_sent")
    })

    it("GOOGLE-LEDGER-7 (default): a void is the next row, after the appended ones", async () => {
        const { ledger, connection } = build()
        await ledger.append(connection, entry("TX-1"))

        await expect(ledger.void(connection, "TX-1")).resolves.toBe("Sheet1!A3:H3")
        await expect(ledger.void(connection, "TX-1")).resolves.toBe("Sheet1!A4:H4")
    })

    it("GOOGLE-LEDGER-8: a refused void is the refused ledger connection and takes no row", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "void", GOOGLE_LEDGER_CASE.voidRefused)

        const error = await failure(ledger.void(connection, "TX-1"))

        expect(error).toMatchObject({ code: ProviderRegistryErrorCode.LedgerConnectionRefused, params: { provider: "google" } })
        await sandbox.setNextCase(account, "void", GOOGLE_LEDGER_CASE.voided)
        await expect(ledger.void(connection, "TX-1")).resolves.toBe("Sheet1!A2:H2")
    })

    it("takes one logged call per request, keyed by the transaction id", async () => {
        const { ledger, connection, sandbox, account } = build()

        await ledger.ready(connection)
        await ledger.append(connection, entry("TX-1"))
        await ledger.void(connection, "TX-1")

        expect((await sandbox.calls(account)).map((call) => [call.operation, call.key])).toEqual([
            ["ready", ""],
            ["append", "TX-1"],
            ["void", "TX-1"],
        ])
    })

    it("is deterministic: two fresh accounts answer the same", async () => {
        const one = build()
        const two = build()

        expect(await one.ledger.append(one.connection, entry("TX-1"))).toEqual(await two.ledger.append(two.connection, entry("TX-1")))
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { ledger } = build()
        const live = await failure(ledger.ready(connectionRecord({ provider: "google", id: "live-1" })))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "google" })
        const off = new GoogleSandboxLedgerService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.ready(connectionRecord({ provider: "google", id: account.id, sandbox: true })))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique GOOGLE-LEDGER-<n> ids, exactly one default per operation, and no inbound case", () => {
        const ids = GOOGLE_LEDGER_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^GOOGLE-LEDGER-\d+$/.test(id))).toBe(true)
        expect(GOOGLE_LEDGER_SANDBOX_CATALOGUE.provider).toBe("google")
        expect(GOOGLE_LEDGER_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined)).toBe(true)
        for (const operation of ["ready", "append", "void"]) {
            expect(GOOGLE_LEDGER_SANDBOX_CATALOGUE.cases.filter((one) => one.operation === operation && one.default === true)).toHaveLength(1)
        }
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(GoogleSandboxLedgerService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
