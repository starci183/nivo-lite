/** What a customer message is about. */
export type Intent = "question" | "order" | "payment_claim" | "attachment" | "other"

/** One line of an order as the customer said it. */
export interface OrderLine {
    /** What was asked for. */
    readonly name: string
    /** How many; at least one. */
    readonly quantity: number
    /** The price of one, VND; the customer's words give none, so null. */
    readonly priceVnd: number | null
}

/** The order the customer asked for. */
export interface OrderSlot {
    /** The lines asked for. */
    readonly items: ReadonlyArray<OrderLine>
    /** Where to deliver, or null. */
    readonly address: string | null
    /** Who orders, or null. */
    readonly customer: string | null
}

/** The payment the customer says they made. */
export interface PaymentClaimSlot {
    /** The amount they claim, VND, or null when they gave none. */
    readonly amountVnd: number | null
    /** The name on the transfer, or null. */
    readonly payerName: string | null
}

/** A file a customer sent with a message, as the trigger of a channel wake carries it. */
export interface TriggerFile {
    /** Its name. */
    readonly name: string
    /** Its type (`image/jpeg`). */
    readonly contentType: string
    /** A short-lived address the model host can fetch. */
    readonly url: string
}

/** One customer message of the burst with the files sent with it. */
export interface TriggerMessage {
    /** What the customer said. */
    readonly text: string
    /** The files sent with it. */
    readonly attachments: ReadonlyArray<TriggerFile>
}

/** The pending customer messages: their words one per line, and each message with its files when the trigger carries them. */
export interface ClassifyInput {
    readonly text: string
    readonly messages: ReadonlyArray<TriggerMessage> | null
}

/** What the batch holds besides words: the pictures the customer sent. */
export interface AttachmentSlot {
    /** How many pictures are no payment receipt. */
    readonly count: number
    /** False when at least one of them could not be understood. */
    readonly understood: boolean
}

/** The intents of the batch and the slots each filled. */
export interface ClassifyOutput {
    /** The intents, each once, in the order the messages raised them; `other` only when nothing else was raised. */
    readonly intents: ReadonlyArray<Intent>
    /** The order slot, or null when the batch holds no order. */
    readonly order: OrderSlot | null
    /** The payment claim slot, or null when the batch holds no claim. */
    readonly paymentClaim: PaymentClaimSlot | null
    /** The pictures that are no payment receipt, or null when there are none. */
    readonly attachment: AttachmentSlot | null
}

/** What the model says one picture is. */
export type ImageKind = "payment_receipt" | "other" | "unreadable"

/** The order as the model writes it, before it is cleaned; what the customer did not say may be absent or null. */
export interface ModelOrder {
    readonly items: ReadonlyArray<{ readonly name: string; readonly quantity?: number | null | undefined }>
    readonly address?: string | null | undefined
    readonly customer?: string | null | undefined
    /** Whatever else the model wrote in the slot, an address under another name included. */
    readonly [member: string]: unknown
}

/** The payment claim as the model writes it, before it is cleaned. */
export interface ModelClaim {
    readonly amount_vnd?: number | string | null | undefined
    readonly payer_name?: string | null | undefined
}

/** The reply the model gives, before it is cleaned; the pictures are answered one kind each, in the order they were shown. */
export interface ModelReply {
    readonly intents: ReadonlyArray<Intent>
    readonly order?: ModelOrder | null | undefined
    readonly payment_claim?: ModelClaim | null | undefined
    readonly images: ReadonlyArray<ImageKind>
}
