import { ConversationOwnershipEventEntity } from "./conversation-ownership-event.entity"

export { ConversationOwnershipEventEntity }

/** The entities the conversation ownership events capability owns, for the app's connection. */
export const conversationOwnershipEventsEntities = [ConversationOwnershipEventEntity] as const
