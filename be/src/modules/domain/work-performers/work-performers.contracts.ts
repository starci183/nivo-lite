/** The customer a message is for. */
export interface DeliveryCustomer {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The channel label the customer came through. */
    readonly channel: string
}

/** How a delivery went. */
export interface CustomerDelivery {
    /** One honest sentence for the log. */
    readonly summary: string
    /** True when the customer really received it. */
    readonly real: boolean
}

/** The customer as the card shows how to reach them. */
export interface DeliveryContact {
    /** The lead id. */
    readonly id: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
}

/** A thank-you after a payment and who wrote it. */
export interface CareText {
    /** The message. */
    readonly text: string
    /** True when the model wrote it; false when it is the filled template because the model did not answer. */
    readonly drafted: boolean
}
