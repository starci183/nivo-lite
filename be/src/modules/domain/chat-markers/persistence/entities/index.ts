import { ChatMarkerEntity } from "./chat-marker.entity"

export { ChatMarkerEntity }

/** The entities the chat markers capability owns, for the app's connection. */
export const chatMarkersEntities = [ChatMarkerEntity] as const
