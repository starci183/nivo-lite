import { readFileSync } from "node:fs"
import type { BusinessLedgerEntry } from "@modules/domain/provider-registry"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { AMIS_SANDBOX_CASE, AMIS_SANDBOX_CATALOGUE } from "./misa-amis-sandbox.catalogue"
import { MisaAmisSandboxLedgerService } from "./misa-amis-sandbox-ledger.service"

const build = () => {
    const account = sandboxAccount({ provider: "misa_amis" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "misa_amis", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, ledger: new MisaAmisSandboxLedgerService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const entry = (transactionId: string): BusinessLedgerEntry => ({
    date: "2026-11-14",
    orderNo: "DH-001",
    customer: "Nguyễn Văn A",
    amountVnd: 250000,
    transactionId,
    status: "paid",
    note: "",
})

describe("MisaAmisSandboxLedgerService", () => {
    it("is ready on a sandbox account (MISA-AMIS-1, the default)", async () => {
        const { ledger, connection } = build()

        await expect(ledger.ready(connection)).resolves.toBe(true)
    })

    it("appends entries as vouchers with running references SBX-AMIS-000001, 000002 (MISA-AMIS-2, the default), and again on a repeat (no dedupe)", async () => {
        const { ledger, connection } = build()

        await expect(ledger.append(connection, entry("TX-1"))).resolves.toBe("SBX-AMIS-000001")
        await expect(ledger.append(connection, entry("TX-2"))).resolves.toBe("SBX-AMIS-000002")
        await expect(ledger.append(connection, entry("TX-1"))).resolves.toBe("SBX-AMIS-000003")
    })

    it("the request never picks the case: a transaction named like an old case is booked", async () => {
        const { ledger, connection } = build()

        await expect(ledger.append(connection, entry("TX-AMIS-TU-CHOI"))).resolves.toBe("SBX-AMIS-000001")
    })

    it("MISA-AMIS-3: refuses the voucher not_available (voucher.create), not_sent, the live refusal shape, and keeps nothing", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "append", AMIS_SANDBOX_CASE.appendRefused)

        const error = await failure(ledger.append(connection, entry("TX-1")))

        expect(providerRefusalReason(error)).toBe("not_available")
        expect(providerRefusalDetail(error)).toBe("voucher.create")
        expect(proofOf(error)).toBe("not_sent")
        expect((await sandbox.calls(account, "append"))[0]?.result.outcome).toBe("threw")
        expect(providerRefusalReason(await failure(ledger.void(connection, "TX-1")))).toBe("not_found")
    })

    it("MISA-AMIS-4: no answer to the voucher is the unknown-outcome failure and keeps nothing", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "append", AMIS_SANDBOX_CASE.appendNoAnswer)

        const error = await failure(ledger.append(connection, entry("TX-1")))

        expect(proofOf(error)).toBe("unknown")
        expect(providerRefusalReason(await failure(ledger.void(connection, "TX-1")))).toBe("not_found")
    })

    it("is sticky: the picked case answers every later append until the default is picked again", async () => {
        const { ledger, connection, sandbox, account } = build()
        await sandbox.setNextCase(account, "append", AMIS_SANDBOX_CASE.appendRefused)

        expect(providerRefusalReason(await failure(ledger.append(connection, entry("TX-1"))))).toBe("not_available")
        expect(providerRefusalReason(await failure(ledger.append(connection, entry("TX-2"))))).toBe("not_available")
        await sandbox.setNextCase(account, "append", AMIS_SANDBOX_CASE.appended)
        await expect(ledger.append(connection, entry("TX-3"))).resolves.toBe("SBX-AMIS-000003")
    })

    it("MISA-AMIS-5: voids a transaction the account appended, running SBX-AMIS-VOID-<n>, and a second void adds another entry", async () => {
        const { ledger, connection } = build()
        await ledger.append(connection, entry("TX-1"))

        await expect(ledger.void(connection, "TX-1")).resolves.toBe("SBX-AMIS-VOID-000001")
        await expect(ledger.void(connection, "TX-1")).resolves.toBe("SBX-AMIS-VOID-000002")
    })

    it("MISA-AMIS-6: refuses the void voucher not_available (voucher.create), not_sent", async () => {
        const { ledger, connection, sandbox, account } = build()
        await ledger.append(connection, entry("TX-1"))
        await sandbox.setNextCase(account, "void", AMIS_SANDBOX_CASE.voidRefused)

        const error = await failure(ledger.void(connection, "TX-1"))

        expect(providerRefusalReason(error)).toBe("not_available")
        expect(providerRefusalDetail(error)).toBe("voucher.create")
        expect(proofOf(error)).toBe("not_sent")
    })

    it("answers not_found (not_sent) for the void of a transaction never appended (a state rule)", async () => {
        const { ledger, connection } = build()

        const error = await failure(ledger.void(connection, "TX-NONE"))

        expect(providerRefusalReason(error)).toBe("not_found")
        expect(proofOf(error)).toBe("not_sent")
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
        const live = await failure(ledger.ready(connectionRecord({ provider: "misa_amis", id: "live-1" })))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "misa_amis" })
        const off = new MisaAmisSandboxLedgerService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.ready(connectionRecord({ provider: "misa_amis", id: account.id, sandbox: true })))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique MISA-AMIS-<n> ids, exactly one default per operation, and no inbound case", () => {
        const ids = AMIS_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toEqual(["MISA-AMIS-1", "MISA-AMIS-2", "MISA-AMIS-3", "MISA-AMIS-4", "MISA-AMIS-5", "MISA-AMIS-6"])
        expect(ids.every((id) => /^MISA-AMIS-\d+$/.test(id))).toBe(true)
        expect(AMIS_SANDBOX_CATALOGUE.provider).toBe("misa_amis")
        expect(AMIS_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined)).toBe(true)
        for (const operation of ["ready", "append", "void"]) {
            expect(AMIS_SANDBOX_CATALOGUE.cases.filter((one) => one.operation === operation && one.default === true)).toHaveLength(1)
        }
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(MisaAmisSandboxLedgerService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
