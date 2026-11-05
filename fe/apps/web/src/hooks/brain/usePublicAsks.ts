"use client"

import { mapSlot } from "@/hooks/slot"
import type { DataSlot, PublicAskView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainGaps } from "./useBrainGaps"

/** The customer questions nobody answered yet, the way to set one aside and the read behind them. */
interface PublicAsksView {
    readonly asks: DataSlot<ReadonlyArray<PublicAskView>>
    readonly skip: (id: string) => void
    readonly reload: () => void
}

/** The unanswered customer questions as rows of the side pane: the words used, how often, where to answer them. */
export const usePublicAsks = (): PublicAsksView => {
    const board = useBrainBoard()
    const gaps = useBrainGaps(board, { answer: "public" })
    return {
        asks: mapSlot(gaps.list.slot, (all) =>
            all.map((row): PublicAskView => ({
                id: row.id,
                question: row.title,
                line: row.lines?.[0] ?? "",
                answerHref: row.actions?.find((action) => action.id === "answer")?.href ?? "",
                isPending: row.actions?.find((action) => action.id === "dismiss")?.isPending === true,
            })),
        ),
        skip: (id) => gaps.dispatch(id, "dismiss"),
        reload: board.reload,
    }
}
