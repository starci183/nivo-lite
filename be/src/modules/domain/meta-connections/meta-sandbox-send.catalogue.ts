import type { SandboxCase } from "@modules/domain/provider-sandbox"

/** The operation of the customer send in the sandbox call log and in the account's next-case selector. */
export const META_SEND_OPERATION = "send"

/**
 * The outbound cases of the Meta customer send, Messenger and Instagram (R62: the account's NEXT CASE picks one, sticky; META-SEND-1
 * answers while nothing is picked). The 24-hour window rule applies before any of them: a person whose last line is older than 24 hours is
 * refused whatever case is picked. The live sender answers only yes or no, so a refusal and a timeout reach the engine as the same
 * unknown outcome; the sandbox answers exactly that.
 */
export const META_SEND_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: "META-SEND-1",
        label: "The send is delivered: the Page's message is accepted by Meta",
        operation: META_SEND_OPERATION,
        default: true,
    },
    {
        id: "META-SEND-2",
        label: "The send is refused outside the window: Meta says the 24-hour messaging window is closed (the live sender's no: an unknown-outcome receipt)",
        operation: META_SEND_OPERATION,
    },
    {
        id: "META-SEND-3",
        label: "The send times out: Meta never answers, so the outcome is unknown (ambiguous receipt)",
        operation: META_SEND_OPERATION,
    },
]
