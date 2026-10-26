export {
    DECIDED_CARDS_SHOWN,
    DECIDED_WORK_LIMIT,
    DECIDED_WORK_STATUSES,
    OFFICE_PAGE_SIZE,
    OFFICE_POLL_MS,
    OPEN_WORK_LIMIT,
    OPEN_WORK_STATUSES,
} from "./office.consts"
export { acceptsCommands, bodyPartsOf, mentionsOf, mergeMessages } from "./office.helpers"
export { chatTargetOf, typingSignalOf, withReceipt, withTypingSignal } from "./office.chat-state"
export type { ChatMarkerWire, TypingSignal } from "./office.chat-state"
export { staffHandlesOf } from "./office.handles"
export type { OfficeMentionViewer } from "./office.conversation-state"
export { infoViewOf } from "./office.info-view"
export { officeListTimeOf, officeListViewOf, mentionOptionsOf, taskViewsOf } from "./office.list-view"
export { approvalCardAnchor, exceptionCardAnchor } from "./office.message-view"
export { buildThreadEntries } from "./office.thread"
export { threadViewsOf } from "./office.thread-view"
export {
    pendingCardRowsOf,
    resultCardAnchor,
    roomAgentsOf,
    roomApprovalsOf,
    roomChannelsOf,
    roomOf,
    roomPinsOf,
    roomRowsOf,
    roomWorksOf,
    toOfficeRoom,
} from "./office.rooms"
export type { OfficeChannelWire } from "./office.rooms"
export type {
    OfficeAgent,
    OfficeAgentConversation,
    OfficeConversationUnread,
    OfficeRoom,
    OfficeApproval,
    OfficeCandidate,
    OfficeLead,
    OfficeMessage,
    OfficePerson,
    OfficeStaff,
    OfficeTask,
    OfficeWork,
} from "./office.types"
export { toOfficeApproval, toOfficeCandidate, toOfficeMessage, toOfficeWork } from "./office.wire"
export { toOfficeAgents, toOfficeLead, toOfficePeople, toOfficeTask } from "./office.team"
export { NIVO_AVATAR } from "./office.words"
export type { OfficeContext, OfficeWords } from "./office.words"
