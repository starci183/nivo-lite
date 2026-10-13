import type { Secret } from "@modules/platform/config"

/** The bank account customers pay into: the account number, the bank's short code and the holder (empty until the owner connects SePay). */
export interface BankAccountOptions {
    /** The account number printed on the VietQR image. */
    readonly account: string
    /** The bank's short code as VietQR lists it. */
    readonly bank: string
    /** The account holder's name. */
    readonly holder: string
}

/** The simulated Vietcombank feed: one shared secret and the one workspace its credits land in. */
export interface SimulatedBankOptions {
    /** The shared secret of the `x-nivo-bank-secret` header; undefined switches the door off. */
    readonly secret: Secret | undefined
    /** The workspace the simulated credits belong to; undefined switches the door off. */
    readonly workspaceId: string | undefined
}

/** Billing configuration parsed once at API boot. */
export interface BillingOptions {
    /** The API key SePay sends as `Authorization: Apikey <key>` to NIVO's own billing webhook; undefined refuses every delivery. */
    readonly sepayApiKey: Secret | undefined
    /** The bank account of the billing QR code. */
    readonly bankAccount: BankAccountOptions
    /** The simulated bank feed. */
    readonly simulatedBank: SimulatedBankOptions
    /** The 32-byte key (base64) that encrypts connection credentials; undefined makes every connection credential unreadable. */
    readonly channelTokenKey: Secret | undefined
}
