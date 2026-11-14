import type { SandboxCase } from "@modules/domain/provider-sandbox"

/** The operation of the customer send in the sandbox call log and in the account's next-case selector. */
export const ZALO_SEND_OPERATION = "send"

/** The operation of the staff send (a text to a member of the team through the OA) in the sandbox call log and in the next-case selector. */
export const ZALO_STAFF_OPERATION = "sendToPerson"

/**
 * The outbound cases of the Zalo OA customer send (R62: the account's NEXT CASE picks one, sticky; ZALO-SEND-1 answers while nothing is
 * picked). The 48-hour window rule applies before any of them: a person whose last line is older than 48 hours is refused with the
 * window receipt whatever case is picked.
 */
export const ZALO_SEND_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: "ZALO-SEND-1",
        label: "The send is delivered: a consultation message acknowledged by Zalo",
        operation: ZALO_SEND_OPERATION,
        default: true,
    },
    {
        id: "ZALO-SEND-2",
        label: "The send is refused outside the window: Zalo says the 48-hour consultation window is closed (zalo_window_expired)",
        operation: ZALO_SEND_OPERATION,
    },
    {
        id: "ZALO-SEND-3",
        label: "The send is refused because the access token is rejected even after a refresh (zalo_token)",
        operation: ZALO_SEND_OPERATION,
    },
    {
        id: "ZALO-SEND-4",
        label: "The send times out: Zalo never answers, so the outcome is unknown (ambiguous)",
        operation: ZALO_SEND_OPERATION,
    },
]

/**
 * The outbound cases of the staff send (a text to a member of the team through the OA, no reply window): ZALO-STAFF-1 answers while
 * nothing is picked; ZALO-STAFF-2 throws what the live route throws when the OA holds no usable token.
 */
export const ZALO_STAFF_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: "ZALO-STAFF-1",
        label: "The staff text is sent: the OA's consultation route accepts it (nothing is returned)",
        operation: ZALO_STAFF_OPERATION,
        default: true,
    },
    {
        id: "ZALO-STAFF-2",
        label: "The staff text is refused: the OA holds no usable access token (CHANNELS_ZALO_NOT_AUTHORIZED)",
        operation: ZALO_STAFF_OPERATION,
    },
]
