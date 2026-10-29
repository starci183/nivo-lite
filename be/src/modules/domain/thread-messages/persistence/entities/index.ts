import { ThreadMessageEntity } from "./thread-message.entity"

export { ThreadMessageEntity } from "./thread-message.entity"
export type { ThreadAuthorKind } from "./thread-message.entity"

/** Every entity of the thread-messages capability. */
export const threadMessagesEntities = [ThreadMessageEntity] as const
