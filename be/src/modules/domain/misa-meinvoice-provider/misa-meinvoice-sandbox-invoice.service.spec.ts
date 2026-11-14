import * as fs from "node:fs"
import type { ConnectionRecord } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { MISA_MEINVOICE_SANDBOX_CATALOGUE, MISA_SANDBOX_CASE } from "./misa-meinvoice-sandbox.catalogue"
import { MisaMeinvoiceSandboxInvoiceService } from "./misa-meinvoice-sandbox-invoice.service"

const ACCOUNT = sandboxAccount({ id: "conn-m", workspaceId: "ws-1", provider: "misa_meinvoice" })
const CONNECTION: ConnectionRecord = connectionRecord({ id: "conn-m", workspaceId: "ws-1", provider: "misa_meinvoice", sandbox: true })
const LIVE_CONNECTION: ConnectionRecord = connectionRecord({ id: "conn-live", workspaceId: "ws-1", provider: "misa_meinvoice" })
const draft = (draftId: string) => ({ draftId, renewalId: "r-1" })

/** The sandbox invoice service over a memory store that knows the sandbox account. */
const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new MisaMeinvoiceSandboxInvoiceService(sandbox) }
}

/** What a rejected promise threw. */
const thrownOf = (run: Promise<unknown>): Promise<unknown> => run.catch((cause: unknown) => cause)

describe("MisaMeinvoiceSandboxInvoiceService", () => {
    it("is the issue port of the MISA meInvoice provider key", () => {
        expect(setup().service.provider).toBe("misa_meinvoice")
    })

    it("MISA-1 (default): issues invoice 1 of the series with no case picked, and logs exactly one issue call", async () => {
        const { sandbox, service } = setup()

        const invoice = await service.issue(CONNECTION, draft("d-1"))

        expect(invoice).toEqual({ id: "sbx-inv-00000001", state: "issued", invoiceNo: "C26TSB/00000001", issuedOn: "2026-11-14" })
        const calls = await sandbox.calls(ACCOUNT, "issue")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ operation: "issue", key: "d-1", request: draft("d-1"), result: { outcome: "answered", value: invoice } })
    })

    it("the request's draft id never picks the case: a draft named like an old case still issues", async () => {
        const { service } = setup()
        expect((await service.issue(CONNECTION, draft("draft-rejected"))).invoiceNo).toBe("C26TSB/00000001")
    })

    it("MISA-1 picked explicitly issues the same", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.issued)
        expect((await service.issue(CONNECTION, draft("d-1"))).invoiceNo).toBe("C26TSB/00000001")
    })

    it("numbers gaplessly, keeps each invoice by draft and by id, and issues a SECOND invoice for the same draft", async () => {
        const { sandbox, service } = setup()

        const first = await service.issue(CONNECTION, draft("d-1"))
        const second = await service.issue(CONNECTION, draft("d-1"))

        expect([first.invoiceNo, second.invoiceNo]).toEqual(["C26TSB/00000001", "C26TSB/00000002"])
        const kept = await sandbox.call(ACCOUNT, "probe", {}, {
            answer: async (state) => [await state.read("invoice", "d-1"), await state.read("invoice", "invoice:sbx-inv-00000001"), await state.read("next", "")],
        })
        expect(kept).toEqual([second, first, 3])
    })

    it("MISA-2: refuses an invalid buyer tax code as rejected, not sent, and consumes no number", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.rejected)

        const thrown = await thrownOf(service.issue(CONNECTION, draft("d-1")))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { provider: "misa_meinvoice", detail: "invalid buyer tax code" } })
        expect(proofOf(thrown)).toBe("not_sent")
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.issued)
        expect((await service.issue(CONNECTION, draft("d-2"))).invoiceNo).toBe("C26TSB/00000001")
        expect((await sandbox.calls(ACCOUNT, "issue")).map((call) => call.result.outcome)).toEqual(["threw", "answered"])
    })

    it("MISA-3: no answer is the unknown-outcome call failure and consumes no number", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.noAnswer)

        const thrown = await thrownOf(service.issue(CONNECTION, draft("d-1")))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.CallUnknown })
        expect(proofOf(thrown)).toBe("unknown")
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.issued)
        expect((await service.issue(CONNECTION, draft("d-2"))).invoiceNo).toBe("C26TSB/00000001")
    })

    it("MISA-4: a server failure is a call failure proved not sent, and consumes no number", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.unavailable)

        const thrown = await thrownOf(service.issue(CONNECTION, draft("d-1")))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.CallNotSent })
        expect(proofOf(thrown)).toBe("not_sent")
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.issued)
        expect((await service.issue(CONNECTION, draft("d-2"))).invoiceNo).toBe("C26TSB/00000001")
    })

    it("MISA-5: a refused credential is auth refused, not sent", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.authRefused)

        const thrown = await thrownOf(service.issue(CONNECTION, draft("d-1")))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedAuth })
        expect(proofOf(thrown)).toBe("not_sent")
    })

    it("MISA-6: a timeout with the effect applied keeps the invoice and consumes its number, then throws unknown", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.timeoutApplied)

        const thrown = await thrownOf(service.issue(CONNECTION, draft("d-1")))

        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.CallUnknown })
        expect(proofOf(thrown)).toBe("unknown")
        const kept = await sandbox.call(ACCOUNT, "probe", {}, { answer: (state) => state.read("invoice", "d-1") })
        expect(kept).toEqual({ id: "sbx-inv-00000001", state: "issued", invoiceNo: "C26TSB/00000001", issuedOn: "2026-11-14" })
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.issued)
        expect((await service.issue(CONNECTION, draft("d-2"))).invoiceNo).toBe("C26TSB/00000002")
    })

    it("is sticky: a picked case answers every later call until changed, one logged call per request", async () => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "issue", MISA_SANDBOX_CASE.rejected)
        const first = await thrownOf(service.issue(CONNECTION, draft("d-1")))
        const second = await thrownOf(service.issue(CONNECTION, draft("d-1")))
        expect(first).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
        expect(second).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
        expect(await sandbox.calls(ACCOUNT, "issue")).toHaveLength(2)
    })

    it("numbers gaplessly across a mix of cases: only invoices that exist take a number", async () => {
        const { sandbox, service } = setup()
        const numbers: Array<string | null> = []
        const picks = [
            MISA_SANDBOX_CASE.issued,
            MISA_SANDBOX_CASE.rejected,
            MISA_SANDBOX_CASE.noAnswer,
            MISA_SANDBOX_CASE.issued,
            MISA_SANDBOX_CASE.timeoutApplied,
            MISA_SANDBOX_CASE.unavailable,
            MISA_SANDBOX_CASE.issued,
        ]
        for (const id of picks) {
            await sandbox.setNextCase(ACCOUNT, "issue", id)
            numbers.push(await service.issue(CONNECTION, draft("d")).then((invoice) => invoice.invoiceNo, () => null))
        }
        expect(numbers).toEqual(["C26TSB/00000001", null, null, "C26TSB/00000002", null, null, "C26TSB/00000004"])
        expect(await sandbox.calls(ACCOUNT, "issue")).toHaveLength(7)
    })

    it("is deterministic: two fresh accounts answer the same sequence", async () => {
        const run = async () => {
            const { sandbox, service } = setup()
            const out: Array<unknown> = []
            for (const id of [MISA_SANDBOX_CASE.issued, MISA_SANDBOX_CASE.rejected, MISA_SANDBOX_CASE.issued]) {
                await sandbox.setNextCase(ACCOUNT, "issue", id)
                out.push(await service.issue(CONNECTION, draft("a")).catch((cause: unknown) => String((cause as Error).name)))
            }
            return out
        }
        expect(await run()).toEqual(await run())
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        expect(await thrownOf(service.issue(LIVE_CONNECTION, draft("d-1")))).toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        const off = sandboxServiceOff(ACCOUNT)
        expect(await thrownOf(new MisaMeinvoiceSandboxInvoiceService(off.sandbox).issue(CONNECTION, draft("d-1")))).toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has a catalogue of unique MISA-<n> ids that all answer issue, exactly one of them the default", () => {
        const ids = MISA_MEINVOICE_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toEqual(["MISA-1", "MISA-2", "MISA-3", "MISA-4", "MISA-5", "MISA-6"])
        expect(ids.every((id) => /^MISA-\d+$/.test(id))).toBe(true)
        expect(MISA_MEINVOICE_SANDBOX_CATALOGUE.cases.filter((one) => one.default === true).map((one) => one.id)).toEqual(["MISA-1"])
        expect(MISA_MEINVOICE_SANDBOX_CATALOGUE.provider).toBe("misa_meinvoice")
        expect(MISA_MEINVOICE_SANDBOX_CATALOGUE.cases.every((one) => one.operation === "issue" && one.inbound === undefined)).toBe(true)
    })

    it("reaches no network: one constructor argument, no integration import, no web address in the source", () => {
        expect(MisaMeinvoiceSandboxInvoiceService.length).toBe(1)
        const source = fs.readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
