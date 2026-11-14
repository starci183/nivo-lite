import type { ChatRoomView } from "@modules/domain/team-chat"
import type { CaptureFact } from "@modules/domain/team-chat-turns"
import { DELIVERY_SUBJECT_VI, FEE_VALUE_VI, INNER_CITY_FEE_VI } from "@tests/fixtures/i18n/team-chat-turns-spec.messages"

/** The private room of the sales agent and its owner, as a screen shows it to the owner: no member listed, nothing unread. */
export const directRoomViewOf = (id: string, createdBy: string, createdAt: Date): ChatRoomView => ({
    id,
    kind: "direct",
    purpose: "direct",
    purposeModule: null,
    name: "Sales",
    withNivo: false,
    position: 0,
    createdBy,
    createdAt,
    members: [],
    unreadCount: 0,
    mentionCount: 0,
    muted: false,
    lastMessage: null,
})

/** The truth the owner names on the capture form: the inner-city shipping fee of delivery is 30 000 VND, open-ended. */
export const NAMED_FACT: CaptureFact = {
    subjectLabel: DELIVERY_SUBJECT_VI,
    attributeLabel: INNER_CITY_FEE_VI,
    value: FEE_VALUE_VI,
    unit: null,
    validFrom: null,
    validTo: null,
}
