import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspacePaymentAccountService } from "@modules/domain/channel-connections"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { FeedAccountFacts } from "@modules/domain/connections"
import { SepayPaymentInstructionService } from "@modules/domain/sepay-provider/sepay-payment-instruction.service"
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

describe("PaymentNativeService on the SePay connection of the walk", () => {
    /** The facts the walk's SePay feed reports: the masked and the full account number and the bank code in the public meta, no holder. */
    const WALK_FEED: FeedAccountFacts = {
        id: "44c471c0-0000-4000-8000-000000000001",
        provider: "sepay",
        status: "active",
        createdAt: new Date("2026-11-06T10:00:00Z"),
        accountNumber: "0123456789",
        bankCode: "MBBANK",
        accountHolder: null,
    }

    it("answers the QR link and the account with the order code in the transfer content, so the credit that comes in matches", async () => {
        const bindings = mock<ConnectionBindingsReadService>()
        bindings.feedAccountsOf.mockImplementation((_workspace, provider) =>
            Promise.resolve(provider === "sepay" ? [WALK_FEED] : []),
        )
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentNativeService,
                PaymentInstructionRegistryService,
                WorkspacePaymentAccountService,
                { provide: ConnectionBindingsReadService, useValue: bindings },
            ],
        }).compile()
        moduleRef.get(PaymentInstructionRegistryService).register(new SepayPaymentInstructionService())

        const answer = await moduleRef.get(PaymentNativeService).invoke("ws-1", "instruction", {
            orderNo: "DH-20261107-0004",
            amountVnd: 2000,
            transferContent: "DH202611070004",
        })

        expect(answer).toMatchObject({
            bankCode: "MBBANK",
            accountNumber: "0123456789",
            accountHolder: "",
            provider: "sepay",
        })
        const qr = new URL(String((answer as { qrUrl: string }).qrUrl))
        expect(qr.origin + qr.pathname).toBe("https://qr.sepay.vn/img")
        expect(Object.fromEntries(qr.searchParams)).toMatchObject({
            acc: "0123456789",
            bank: "MBBANK",
            amount: "2000",
            des: "DH202611070004",
        })
    })
})
