import type { AccountOwner, PendingRow } from "@modules/domain/account-data"

/** The connection the Zalo rows of a spec belong to unless it names another. */
export const ZALO_CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"

/** The account the Zalo rows of a spec belong to. */
export const ZALO_OWNER: AccountOwner = { provider: "zalo_oa", connectionId: ZALO_CONNECTION, workspaceId: "w-1" }

/** The text message of user-1 a delivery holds unless a spec names another body. */
export const ZALO_TEXT_EVENT = {
    app_id: "app-1",
    event_name: "user_send_text",
    sender: { id: "user-1" },
    message: { msg_id: "m-1", text: "Hello" },
}

/** The text message as the webhook posts it. */
export const ZALO_TEXT_BODY: string = JSON.stringify(ZALO_TEXT_EVENT)

/** The pending `zalo_oa.event` row holding the given raw event under the given key, from the given source when it is not the webhook. */
export const zaloEventPendingOf = (
    raw: object = ZALO_TEXT_EVENT,
    key = "m-1",
    source?: "poll" | "manual_import",
): PendingRow => ({
    id: "row-1",
    type: "zalo_oa.event",
    key,
    owner: ZALO_OWNER,
    value: { eventId: key, event: "user_send_text", ...(source === undefined ? {} : { source }), raw },
})
