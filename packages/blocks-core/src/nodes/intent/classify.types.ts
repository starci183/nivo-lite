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
    /** What the customer said, one message per line. */
    readonly text: string
    /** Each message with its files, or null when the trigger carries only the words. */
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
    /** The items the customer named. */
    readonly items: ReadonlyArray<{ readonly name: string; readonly quantity?: number | null | undefined }>
    /** The delivery address, when the customer gave one. */
    readonly address?: string | null | undefined
    /** The name of who orders, when the customer gave one. */
    readonly customer?: string | null | undefined
}

/** The payment claim as the model writes it, before it is cleaned. */
export interface ModelClaim {
    /** The amount the customer says was sent. */
    readonly amount_vnd?: number | string | null | undefined
    /** The name the customer says the transfer carries. */
    readonly payer_name?: string | null | undefined
}

/** The reply the model gives, before it is cleaned; the pictures are answered one kind each, in the order they were shown. */
export interface ModelReply {
    /** The intents the model found. */
    readonly intents: ReadonlyArray<Intent>
    /** The order the model read, when the batch holds one. */
    readonly order?: ModelOrder | null | undefined
    /** The payment claim the model read, when the batch holds one. */
    readonly payment_claim?: ModelClaim | null | undefined
    /** What the model says each picture is, in the order they were shown. */
    readonly images: ReadonlyArray<ImageKind>
}
