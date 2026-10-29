import { MessageEntity } from "./message.entity"

export { MessageEntity }
export type { MessageAuthorKind } from "./message.entity"

/** The entities the messages capability owns, collected by the database module. */
export const messagesEntities = [MessageEntity] as const
