import { zaloInboxEntities } from "@modules/domain/zalo-inbox"

const ZaloInboxEntity: (typeof zaloInboxEntities)[0] = zaloInboxEntities[0]
type ZaloInboxEntity = InstanceType<typeof ZaloInboxEntity>

/** The connection every receipt of the Zalo inbox specs belongs to. */
export const ZALO_CONNECTION = "c-1"

/** A pending Zalo inbox receipt holding the raw delivery `rawBody`, as a webhook or, when `source` is given, a poll or an import stored it. */
export const receiptBodyOf = (rawBody: string, source?: "poll" | "manual_import"): ZaloInboxEntity =>
    Object.assign(new ZaloInboxEntity(), {
        id: "receipt-1",
        provider: "zalo",
        payload: { connection: ZALO_CONNECTION, rawBody, ...(source === undefined ? {} : { source }) },
    })
