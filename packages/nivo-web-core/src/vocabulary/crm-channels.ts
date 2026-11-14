/**
 * The CRM's channel words, as its operations take them: part of the plugin's contract with the CRM, never a node's mapping. A node
 * hands on the channel id a NIVO answer named (a conversation's `channel`, `email` for a mail) and reads the CRM's word here: exact
 * equality on the declared channel ids, no meaning read from text.
 */

/** Where a purchase came in, as `purchase.create` takes it (`PurchaseChannel` of the CRM's document). */
export type CrmPurchaseChannel = "zalo" | "email" | "phone" | "web" | "other"

/**
 * The NIVO channel ids the CRM names with the same word on a purchase. Every other channel (Telegram, Messenger, Instagram, the website
 * chat) is `other` for the CRM, as it was before this table moved here from `websales.purchase-open`.
 */
const PURCHASE_CHANNELS: ReadonlyMap<string, CrmPurchaseChannel> = new Map<string, CrmPurchaseChannel>([
    ["zalo", "zalo"],
    ["email", "email"],
])

/** The CRM's word for the channel a purchase came in through: the table's, else `other`. */
export const crmPurchaseChannelOf = (channel: string): CrmPurchaseChannel => PURCHASE_CHANNELS.get(channel) ?? "other"
