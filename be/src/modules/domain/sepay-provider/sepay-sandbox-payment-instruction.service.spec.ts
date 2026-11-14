import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { SepaySandboxPaymentInstructionService } from "./sepay-sandbox-payment-instruction.service"
import { vietQrUrl } from "./viet-qr.policy"

const ACCOUNT = sandboxAccount({ id: "conn-s", workspaceId: "ws-1", provider: "sepay" })
const CONNECTION = connectionRecord({ id: "conn-s", workspaceId: "ws-1", provider: "sepay", sandbox: true })
const REQUEST = { amountVnd: 350000, content: "NIVO-DH1001" }

const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new SepaySandboxPaymentInstructionService(sandbox) }
}

describe("SepaySandboxPaymentInstructionService", () => {
    it("answers the fixed receiving account with the amount and content echoed and the VietQR link", async () => {
        const { service } = setup()

        const instruction = await service.transfer(CONNECTION, REQUEST)

        expect(instruction).toEqual({
            qrImageUrl: vietQrUrl({ accountNumber: "0011004455667", bankCode: "VCB" }, 350000, "NIVO-DH1001"),
            bankCode: "VCB",
            accountNumber: "0011004455667",
            accountHolder: "NIVO SANDBOX SHOP",
            content: "NIVO-DH1001",
            amountVnd: 350000,
        })
    })

    it("draws the QR of the account the caller names, as the live one does", () => {
        const { service } = setup()

        expect(service.qrUrl({ accountNumber: "1", bankCode: "B" }, { orderNo: "o", amountVnd: 5, transferContent: "c" })).toBe(
            vietQrUrl({ accountNumber: "1", bankCode: "B" }, 5, "c"),
        )
    })

    it("logs exactly one call per request and is deterministic", async () => {
        const { sandbox, service } = setup()

        expect(await service.transfer(CONNECTION, REQUEST)).toEqual(await service.transfer(CONNECTION, REQUEST))
        const calls = await sandbox.calls(ACCOUNT, "transfer")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: "NIVO-DH1001", request: REQUEST, result: { outcome: "answered" } })
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { service } = setup()
        const off = new SepaySandboxPaymentInstructionService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.transfer({ ...CONNECTION, sandbox: false }, REQUEST)).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
        await expect(off.transfer(CONNECTION, REQUEST)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(SepaySandboxPaymentInstructionService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
