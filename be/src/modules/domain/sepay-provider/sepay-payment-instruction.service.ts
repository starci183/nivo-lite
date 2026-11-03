import { Injectable } from "@nestjs/common"
import type {
    InstructionAccount,
    PaymentInstructionPort,
    PaymentInstructionRequest,
} from "@modules/domain/provider-registry"
import { vietQrUrl } from "./viet-qr.policy"

@Injectable()
/** Draws the SePay VietQR image a payer scans to pay an order into the workspace's SePay account. */
export class SepayPaymentInstructionService implements PaymentInstructionPort {
    readonly provider = "sepay"

    /** The QR image link for one transfer: the amount and the transfer content are fixed in it. */
    qrUrl(account: InstructionAccount, request: PaymentInstructionRequest): string {
        return vietQrUrl(account, request.amountVnd, request.transferContent)
    }
}
