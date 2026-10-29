import { EmailMessageEntity } from "./email-message.entity"

export { EmailMessageEntity }
export type { EmailMessageRefs, EmailMessageStatus, EmailMessageVia } from "./email-message.entity"

/** The entities the email-messages capability owns, collected by the database module. */
export const emailMessagesEntities = [EmailMessageEntity] as const
