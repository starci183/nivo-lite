import type { CareOptOutAnswer, CareOptOutView } from "@modules/domain/agent-doors"
import type { ConversationRelease } from "@modules/domain/agent-graphs"
import type { CareOptOutType, ConversationReleaseType, SetCareOptOutType } from "./dto/agent-doors.type"

/** Maps a customer's opt-out to the GraphQL type. */
export const toCareOptOutType = (view: CareOptOutView): CareOptOutType => ({
    leadId: view.leadId,
    optedOut: view.optedOut,
    lastPress:
        view.lastPress === null
            ? null
            : {
                  memberId: view.lastPress.memberId,
                  memberName: view.lastPress.memberName,
                  outcome: view.lastPress.outcome,
                  at: view.lastPress.at,
              },
})

/** Maps what setting the opt-out did to the GraphQL type. */
export const toSetCareOptOutType = (answer: CareOptOutAnswer): SetCareOptOutType => ({
    outcome: answer.outcome,
    careOptOut: answer.view === null ? null : toCareOptOutType(answer.view),
})

/** Maps what handing a conversation back did to the GraphQL type. */
export const toConversationReleaseType = (release: ConversationRelease): ConversationReleaseType => ({ ...release })
