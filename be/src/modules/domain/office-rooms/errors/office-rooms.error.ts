import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the office rooms capability. */
export enum OfficeRoomsErrorCode {
    /** The room key is not one of the Hub rooms. */
    RoomInvalid = "OFFICE_ROOMS_ROOM_INVALID",
    /** The conversation kind is not a direct one, or its id names no agent or lead of the workspace. */
    ConversationInvalid = "OFFICE_ROOMS_CONVERSATION_INVALID",
}

/** How each office rooms code travels. */
export const OFFICE_ROOMS_ERROR_KINDS: Record<OfficeRoomsErrorCode, ErrorKind> = {
    [OfficeRoomsErrorCode.RoomInvalid]: "invalid",
    [OfficeRoomsErrorCode.ConversationInvalid]: "invalid",
}

/** The one error class of the office rooms capability. */
export class OfficeRoomsError extends DomainError<OfficeRoomsErrorCode> {}
