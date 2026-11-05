import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspacePaymentAccountService } from "@modules/domain/channel-connections"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { PaymentInstructionRegistryService } from "@modules/domain/provider-registry"
import { PAYMENT_MANIFEST, PaymentNativeService } from "./payment-native.service"

const ARGS = { orderNo: "DH-7", amountVnd: 5000, transferContent: "DH7 thanh toan" }
const ACCOUNT = {
    accountNumber: "525209999",
    bankCode: "VCB",
    holder: "NIVO",
    provider: "sepay",
    connectionId: "connection-sepay",
}

const build = async () => {
    const accounts = mock<WorkspacePaymentAccountService>()
    const qrUrl = jest.fn().mockReturnValue("https://qr.example/img")
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentNativeService,
            PaymentInstructionRegistryService,
            { provide: WorkspacePaymentAccountService, useValue: accounts },
        ],
    }).compile()
    moduleRef.get(PaymentInstructionRegistryService).register({ provider: "sepay", qrUrl })
    return { service: moduleRef.get(PaymentNativeService), accounts, qrUrl }
}

describe("PaymentNativeService", () => {
    it("announces one read tool named by the capability, with the account number masked in the audit", () => {
        expect(PAYMENT_MANIFEST.key).toBe("payment")
        expect(PAYMENT_MANIFEST.tools.map((tool) => tool.name)).toEqual(["instruction"])
        expect(PAYMENT_MANIFEST.tools[0]).toMatchObject({ scope: "read", secretFields: ["accountNumber"] })
    })

    it("answers the instruction of the workspace account, built by the provider of that account", async () => {
        const { service, accounts, qrUrl } = await build()
        accounts.accountOf.mockResolvedValue(ACCOUNT)

        await expect(service.invoke("ws-1", "instruction", ARGS)).resolves.toEqual({
            bankName: "Vietcombank",
            bankCode: "VCB",
            accountNumber: "525209999",
            accountHolder: "NIVO",
            qrUrl: "https://qr.example/img",
            provider: "sepay",
        })
        expect(qrUrl).toHaveBeenCalledWith(ACCOUNT, ARGS)
    })

    it("answers an empty holder when the feed has none", async () => {
        const { service, accounts } = await build()
        accounts.accountOf.mockResolvedValue({ ...ACCOUNT, holder: null })

        await expect(service.invoke("ws-1", "instruction", ARGS)).resolves.toMatchObject({ accountHolder: "" })
    })

    it.each([
        ["no bank account", null],
        ["a provider that registered no instruction", { ...ACCOUNT, provider: "casso" }],
    ])("is not connected with %s", async (_name, account) => {
        const { service, accounts } = await build()
        accounts.accountOf.mockResolvedValue(account)

        await expect(service.invoke("ws-1", "instruction", ARGS)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
    })

    it("refuses arguments outside the schema and tools it does not have", async () => {
        const { service } = await build()

        await expect(service.invoke("ws-1", "instruction", { ...ARGS, amountVnd: 0 })).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        await expect(service.invoke("ws-1", "other", ARGS)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })
})
