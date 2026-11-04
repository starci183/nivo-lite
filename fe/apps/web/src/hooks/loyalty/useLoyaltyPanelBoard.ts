"use client"

import { useSlotLabels } from "@/hooks/slot"
import { toast } from "@/modules/toast"
import { EMPTY_LOYALTY_BOARD, type LoyaltyPanelInput } from "./loyalty.shared"
import type { LoyaltyBoardType } from "@/hooks/swr"
import type { SlotLabels } from "@/modules/types"

/** The view `useLoyaltyPanelBoard` returns. */
export interface LoyaltyPanelBoardView {
    read: LoyaltyPanelInput["read"]
    board: LoyaltyBoardType
    slotLabels: (empty: string) => SlotLabels
    retry: () => void
}

/** The board a loyalty panel reads (the empty one while it is on its way, so the placeholder is the same tree), its labels and the way to read it again. */
export const useLoyaltyPanelBoard = (input: LoyaltyPanelInput): LoyaltyPanelBoardView => {
    const slotLabels = useSlotLabels()
    const retry = () => {
        input.read.mutate().catch(() => toast.danger(slotLabels("").error))
    }
    return { read: input.read, board: input.read.data ?? EMPTY_LOYALTY_BOARD, slotLabels, retry }
}
