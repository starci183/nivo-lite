import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    type InstructionAccount,
    type PaymentInstructionPort,
    type PaymentInstructionRequest,
    type TransferInstruction,
    type TransferInstructionRequest,
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

    /**
     * The generic transfer instruction of one SePay account: the account's own receiving details (`account_number`, `bank_code`,
     * `account_holder` of the connection) and the QR image link composed from them. SePay's documentation (VietQR "tao QR code",
     * https://docs.sepay.vn/tao-qr-code-vietqr-dong.html and https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code) states
     * `GET .../img?acc=&bank=&amount=&des=` with `acc` and `bank` required; it names no instruction an API creates, no expiry and no
     * provider reference, so none is answered. Nothing is called: the address is composed here, so the call proves nothing to retry.
     * An account without its number or bank code cannot give an instruction (`no_credential`: the owner fills the connection).
     */
    transfer(connection: ConnectionRecord, request: TransferInstructionRequest): Promise<TransferInstruction> {
        const accountNumber = connection.meta.account_number ?? ""
        const bankCode = connection.meta.bank_code ?? ""
        if (accountNumber === "" || bankCode === "") return Promise.reject(providerRefusal(this.provider, "no_credential"))
        const holder = connection.meta.account_holder ?? ""
        return Promise.resolve({
            qrImageUrl: vietQrUrl({ accountNumber, bankCode }, request.amountVnd, request.content),
            bankCode,
            accountNumber,
            ...(holder === "" ? {} : { accountHolder: holder }),
            content: request.content,
            amountVnd: request.amountVnd,
        })
    }
}
