/** A picture or file a customer sent on a channel, where the channel serves it, before the shop keeps a copy. */
export interface CustomerAttachment {
    /** `image` or `file`. */
    readonly kind: "image" | "file"
    /** The channel's address of the bytes (it may expire); empty when the channel gave none. */
    readonly url: string
    /** The name the sender gave it, or an empty text. */
    readonly name: string
}

/** The bytes of a kept customer file, as a model call carries them. */
export interface CustomerFileBytes {
    /** The type read from the bytes. */
    readonly contentType: string
    /** The bytes. */
    readonly bytes: Uint8Array
}

/** A kept customer file's bytes, or null when the store no longer holds it or the address is not the shop's. */
export type OptionalCustomerFileBytes = CustomerFileBytes | null
