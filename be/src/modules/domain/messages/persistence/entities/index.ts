import { MessageEntity } from "./message.entity"

export { MessageEntity }
export type { MessageAuthorKind } from "./message.entity"

/** The entities the messages capability owns, collected by the database module. */
export const messagesEntities: readonly [typeof MessageEntity] = [MessageEntity] as const
