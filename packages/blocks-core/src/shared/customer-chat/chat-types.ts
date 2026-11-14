import { DomainError } from "@starci/common"

/** Codes of what the chatbot's record services throw. */
export type CustomerChatCode =
    /** The conversation does not exist in the workspace. */
    | "CUSTOMER_CHAT_NOT_FOUND"
    /** The engine refused the write: the record was not stored. */
    | "CUSTOMER_CHAT_NOT_STORED"

/** What a record service throws: a record is missing or a write was refused. */
export class CustomerChatError extends DomainError<CustomerChatCode> {
    constructor(code: CustomerChatCode, at: string, options?: { readonly cause?: unknown }) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
