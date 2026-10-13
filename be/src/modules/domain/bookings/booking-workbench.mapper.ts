import type { BookingBoard, BookingBoardParams } from "./booking-board.contracts"
import type { AddBookingParams, DeskPlacement } from "./bookings.contracts"
import type {
    SaveBookingExceptionParams,
    SaveBookingResourceParams,
    SaveBookingServiceParams,
} from "./booking-setup.contracts"
import type {
    BookingBoardDraft,
    BookingBoardProjection,
    BookingDeskDraft,
    BookingExceptionDraft,
    BookingPlacement,
    BookingResourceDraft,
    BookingServiceDraft,
} from "./booking-workbench.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"

const REFUSAL_CODES = {
    service_required: BookingsErrorCode.ServiceRequired,
    name_required: BookingsErrorCode.NameRequired,
    datetime_invalid: BookingsErrorCode.DateTimeInvalid,
    service_not_found: BookingsErrorCode.ServiceNotFound,
    closed: BookingsErrorCode.Closed,
    full: BookingsErrorCode.Full,
    no_resource: BookingsErrorCode.NoResource,
    taken: BookingsErrorCode.Taken,
    not_movable: BookingsErrorCode.NotMovable,
    resource_not_found: BookingsErrorCode.ResourceNotFound,
} as const

/** Resolves omitted range values without selecting a workspace outside the caller's request. */
export const toBookingBoardRequest = (workspaceId: string, draft?: BookingBoardDraft): BookingBoardParams => ({
    workspaceId,
    ...(draft?.from === undefined || draft.from === null ? {} : { from: draft.from }),
    ...(draft?.to === undefined || draft.to === null ? {} : { to: draft.to }),
})

/** Projects status dictionaries into typed rows while preserving every calendar field. */
export const toBookingBoardType = (board: BookingBoard): BookingBoardProjection => ({
    ...board,
    stats: {
        ...board.stats,
        byStatus: Object.entries(board.stats.byStatus).map(([status, count]) => ({ status, count })),
    },
})

/** Turns a refused placement into its domain error and exposes a successful appointment identity. */
const bookingPlacement = (placement: DeskPlacement): BookingPlacement => {
    if (!placement.ok || placement.id === null) {
        throw new BookingsError({
            code: placement.reason === null ? BookingsErrorCode.NotCreated : REFUSAL_CODES[placement.reason],
        })
    }
    return { id: placement.id }
}

/** Resolves the optional customer details and automatic resource choice of a desk draft. */
export const toAddBookingRequest = (workspaceId: string, draft: BookingDeskDraft): AddBookingParams => ({
    ...draft,
    workspaceId,
    resourceId: draft.resourceId ?? "",
    phone: draft.phone ?? "",
    note: draft.note ?? "",
})

/** Makes service catalog creation and unset price/follow-up values explicit. */
export const toSaveBookingServiceRequest = (
    workspaceId: string,
    draft: BookingServiceDraft,
): SaveBookingServiceParams => ({
    ...draft,
    workspaceId,
    id: draft.id ?? null,
    priceVnd: draft.priceVnd ?? null,
    followupDays: draft.followupDays ?? null,
})

/** Makes resource creation and the absent staff link explicit. */
export const toSaveBookingResourceRequest = (
    workspaceId: string,
    draft: BookingResourceDraft,
): SaveBookingResourceParams => ({
    ...draft,
    workspaceId,
    id: draft.id ?? null,
    staffId: draft.staffId ?? null,
})

/** Applies the whole-business scope when an exception has no resource. */
export const toSaveBookingExceptionRequest = (
    workspaceId: string,
    draft: BookingExceptionDraft,
): SaveBookingExceptionParams => ({
    ...draft,
    workspaceId,
    resourceId: draft.resourceId ?? null,
})

/** Projects the successfully created appointment identity. */
export const toAddBookingType = (placement: DeskPlacement): BookingPlacement => bookingPlacement(placement)

/** Projects the successfully relocated appointment identity. */
export const toMoveBookingType = (placement: DeskPlacement): BookingPlacement => bookingPlacement(placement)
