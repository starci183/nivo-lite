import { ChannelReceiptEntity } from "./channel-receipt.entity"

export { ChannelReceiptEntity }

/** The entities the channel receipts capability owns, for the app's connection. */
export const channelReceiptsEntities = [ChannelReceiptEntity] as const
