"use client"

import { mapSlot } from "@/hooks/slot"
import type { DataSlot, ZaloPasteView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** The two addresses the owner pastes into Zalo. */
export const useZaloPaste = (connectionId: string): DataSlot<ZaloPasteView> => {
    const { slot } = useZaloPage(connectionId)
    return mapSlot(slot, (page) => ({ callbackUrl: page.callbackUrl, webhookUrl: page.webhookUrl }))
}
