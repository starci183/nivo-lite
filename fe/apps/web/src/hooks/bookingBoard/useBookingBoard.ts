import { useQueryBookingBoardSwr } from "@/hooks/swr/api/graphql"
import { toBookingBoard } from "./bookingBoard.adapter"
import { EMPTY_BOOKING_BOARD } from "./bookingBoard.shared"

/** The booking board of the active workspace for the setup and statistics tabs: the empty board until the answer arrives, `isFailed` when it could not be read. */
export const useBookingBoard = () => {
    const { data, error } = useQueryBookingBoardSwr({}, { keepPreviousData: true })
    return {
        board: data === undefined ? EMPTY_BOOKING_BOARD : toBookingBoard(data),
        isLoaded: data !== undefined,
        isFailed: error !== undefined,
    }
}
