import { Injectable } from "@nestjs/common"
import { WorkspacePaymentAccountService, bankDisplayNameOf } from "@modules/domain/channel-connections"
import {
    type GatewayJson,
    type NativeAdapter,
    type NativeConnectorManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/mcp-gateway"
import { PaymentInstructionRegistryService } from "@modules/domain/provider-registry"
import { nativeRefusal } from "./native-refusal.policy"
import { PAYMENT_INSTRUCTION_INPUT_SCHEMA, PAYMENT_INSTRUCTION_SCHEMA } from "./payment-native.schema"

/** The payment capability: named by what it does, never by the provider that answers it. */
export const PAYMENT_MANIFEST: NativeConnectorManifest = {
    key: "payment",
    name: "Payment",
    kind: "native",
    contractVersion: "payment-native@1",
    tools: [
        {
            name: "instruction",
            description:
                "How a payer pays one order: the workspace bank, account and a QR link with the amount and transfer content fixed in it.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: PAYMENT_INSTRUCTION_INPUT_SCHEMA,
            argumentSchema: PAYMENT_INSTRUCTION_SCHEMA,
            secretFields: ["accountNumber"],
        },
    ],
}

@Injectable()
/**
 * `payment.instruction` for a workspace: the account is the one of the workspace own bank feed, and the provider of that feed, found
 * in the registry, builds the QR. A workspace with no bank account, or whose provider registered no payment instruction, is not connected.
 */
export class PaymentNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = PAYMENT_MANIFEST

    constructor(
        private readonly accounts: WorkspacePaymentAccountService,
        private readonly providers: PaymentInstructionRegistryService,
    ) {}

    /** Runs `instruction`; any other tool is unknown. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson): Promise<GatewayJson> {
        if (tool !== "instruction") throw unknownTool(tool)
        const request = argumentsOf(tool, PAYMENT_INSTRUCTION_SCHEMA, args)
        const account = await this.accounts.accountOf(workspaceId)
        const provider = account === null ? undefined : this.providers.of(account.provider)
        if (account === null || provider === undefined) throw nativeRefusal("not_connected")
        return {
            bankName: bankDisplayNameOf(account.bankCode),
            bankCode: account.bankCode,
            accountNumber: account.accountNumber,
            accountHolder: account.holder ?? "",
            qrUrl: provider.qrUrl(account, request),
            provider: account.provider,
        }
    }
}
