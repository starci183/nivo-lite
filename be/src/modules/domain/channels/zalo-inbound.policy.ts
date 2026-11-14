import type { AccountDataReadService } from "@modules/domain/account-data"

/** The raw message type of the Zalo OA (`<provider>.message`, purpose `chat.message`): the engine's own record of what a customer wrote. */
export const ZALO_MESSAGE_TYPE = "zalo_oa.message"
/** The member of the raw Zalo message that names the person (the first member of its declared index). */
export const ZALO_MESSAGE_PERSON = "userId"
/** The member of the raw message that says which way it went. */
export const MESSAGE_DIRECTION = "direction"
/** The direction of a message the customer wrote: only these open the reply window. */
export const INBOUND = "in"

/**
 * When the person last wrote to the OA, from the engine's own stored inbound messages of the connection; null when they never did (or the
 * app keeps no account store). The reply window and the list of recent writers read this, never a conversation record.
 */
export const lastInboundAt = async (
    rows: AccountDataReadService | undefined,
    connectionId: string,
    userId: string,
): Promise<Date | null> => {
    if (rows === undefined) return null
    const last = await rows.newestWhereAlso(connectionId, ZALO_MESSAGE_TYPE, ZALO_MESSAGE_PERSON, userId, {
        field: MESSAGE_DIRECTION,
        equals: INBOUND,
    })
    return last?.occurredAt ?? null
}
