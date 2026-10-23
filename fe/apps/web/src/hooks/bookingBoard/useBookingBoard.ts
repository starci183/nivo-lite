import { useQueryBookingBoardSwr } from "@/hooks/swr"
import { toBookingBoard, EMPTY_BOOKING_BOARD } from "./bookingBoard.shared"
import { readError } from "@/hooks/workspaceread"

/** The booking board of the active workspace for the setup and statistics tabs: the empty board until the answer arrives, `isFailed` when it could not be read. */
export const useBookingBoard = () => {
    const swrRead = useQueryBookingBoardSwr({}, { keepPreviousData: true })
    const { data } = swrRead
    const error = readError(swrRead)
    return {
        board: data === undefined ? EMPTY_BOOKING_BOARD : toBookingBoard(data),
        isLoaded: data !== undefined,
        isFailed: error !== undefined,
    }
}
