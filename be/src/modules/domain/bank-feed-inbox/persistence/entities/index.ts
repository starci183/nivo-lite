import { BankFeedInboxEntity } from "./bank-feed-inbox.entity"

export { BankFeedInboxEntity }

/** Every entity the bank-feed-inbox capability owns, collected by the database connection. */
export const bankFeedInboxEntities = [BankFeedInboxEntity] as const
