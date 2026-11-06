import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the office rooms capability. */
export enum OfficeRoomsErrorCode {
    /** The room key is not one of the Hub rooms. */
    RoomInvalid = "OFFICE_ROOMS_ROOM_INVALID",
}

/** How each office rooms code travels. */
export const OFFICE_ROOMS_ERROR_KINDS: Record<OfficeRoomsErrorCode, ErrorKind> = {
    [OfficeRoomsErrorCode.RoomInvalid]: "invalid",
}

/** The one error class of the office rooms capability. */
export class OfficeRoomsError extends DomainError<OfficeRoomsErrorCode> {}
