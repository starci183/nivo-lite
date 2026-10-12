export { OFFICE_ERROR_KINDS, OfficeError, OfficeErrorCode } from "./errors/office.error"
export { OFFICE_MESSAGES } from "./messages/office.messages"
export { OfficeModule } from "./office.module"
export { OfficeCommandService } from "./office-command.service"
export { OfficeThreadService } from "./office-thread.service"
export type {
    ApprovalView,
    CandidateStatus,
    CandidateView,
    ConfirmRequest,
    ConfirmResult,
    MessageCursor,
    MessagePage,
    MessagePageQuery,
    MessageView,
    OptionalMessageCursor,
    ProposeOutcome,
    ProposeRequest,
    ShownRow,
} from "./office.contracts"
