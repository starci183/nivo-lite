import { useState } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { unsettledMoves, withMove, withoutMove } from "../../rows/board-rows"
import type { BoardMoves, Placed } from "../../rows/board-rows"

/** The pending moves of a board and the command that makes one. */
export interface BoardMover {
    /** The column each moved card is shown in until the read catches up, by card id. */
    readonly moved: BoardMoves
    /** Shows the card in the column at once and runs the move action; a refusal puts the card back and says so. */
    readonly moveCard: (id: string, column: string) => void
}

/**
 * Keeps the moves the person made on a board. The move shows at once, the action runs with the card's id and the column in the
 * value `to`, and a refusal or a failure removes the move and calls `onFailed`. A move the read now agrees with is left out when
 * the next move is made.
 */
export const useBoardMoves = (
    move: ActionHandle,
    cards: ReadonlyArray<Placed> | null,
    onFailed: () => void,
): BoardMover => {
    const [moved, setMoved] = useState<BoardMoves>({})
    const moveCard = (id: string, column: string): void => {
        setMoved((current) => withMove(unsettledMoves(current, cards ?? []), id, column))
        const restore = (): void => {
            setMoved((current) => withoutMove(current, id))
            onFailed()
        }
        move.run({ id, values: { to: column } })
            .then((outcome) => {
                if (!outcome.ok) restore()
            })
            .catch(restore)
    }
    return { moved: unsettledMoves(moved, cards ?? []), moveCard }
}
