import type { CareOptOutAnswer, CareOptOutView, ConversationRelease } from "@modules/domain/agent-doors"
import type { CareOptOutType, ConversationReleaseType, SetCareOptOutType } from "./dto/agent-doors.type"

/** Maps a customer's opt-out to the GraphQL type (its shape already is the type's); null when the workspace has no such customer. */
export const toCareOptOutType = (view: CareOptOutView | null): CareOptOutType | null => view

/** Maps what setting the opt-out did to the GraphQL type. */
export const toSetCareOptOutType = (answer: CareOptOutAnswer): SetCareOptOutType => ({
    outcome: answer.outcome,
    careOptOut: answer.view,
})

/** Maps what handing a conversation back did to the GraphQL type. */
export const toConversationReleaseType = (release: ConversationRelease): ConversationReleaseType => ({ ...release })
