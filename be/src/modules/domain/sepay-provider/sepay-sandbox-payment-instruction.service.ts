import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import type {
    InstructionAccount,
    PaymentInstructionPort,
    PaymentInstructionRequest,
    TransferInstruction,
    TransferInstructionRequest,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { SEPAY_SANDBOX_ACCOUNT } from "./sepay-sandbox.catalogue"
import { vietQrUrl } from "./viet-qr.policy"

@Injectable()
/**
 * The sandbox twin of the SePay payment instruction: the catalogue's one receiving account, the amount and content of the request echoed
 * (each call is logged: R62's "latest payment request" the Sandbox page prefills `SEPAY-<n>` inputs from), and the VietQR image link composed from them by the live builder. The live instruction calls nothing either; the only
 * difference is the account, which is the catalogue's fixed one instead of the connection's own details.
 */
export class SepaySandboxPaymentInstructionService implements PaymentInstructionPort {
    readonly provider = "sepay"

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /**
     * The QR image link for one transfer. The port answers it synchronously, so it cannot go through the sandbox call frame (and logs
     * nothing): it is composed from the account the caller names, as the live one is.
     */
    qrUrl(account: InstructionAccount, request: PaymentInstructionRequest): string {
        return vietQrUrl(account, request.amountVnd, request.transferContent)
    }

    /** The fixed instruction of the catalogue for any amount and content. */
    transfer(connection: ConnectionRecord, request: TransferInstructionRequest): Promise<TransferInstruction> {
        return this.sandbox.call(connection, "transfer", request, {
            key: request.content,
            answer: () => ({
                qrImageUrl: vietQrUrl(SEPAY_SANDBOX_ACCOUNT, request.amountVnd, request.content),
                bankCode: SEPAY_SANDBOX_ACCOUNT.bankCode,
                accountNumber: SEPAY_SANDBOX_ACCOUNT.accountNumber,
                accountHolder: SEPAY_SANDBOX_ACCOUNT.accountHolder,
                content: request.content,
                amountVnd: request.amountVnd,
            }),
        })
    }
}
