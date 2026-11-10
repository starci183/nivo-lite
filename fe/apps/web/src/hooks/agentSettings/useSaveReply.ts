"use client"

import { useCallback } from "react"
import { useMutateSaveHoldingMessageSwr } from "@/hooks/swr"
import { useSettingSaved } from "./useSettingSaved"

/** The view `useSaveReply` returns. */
export interface SaveReplyView {
    holding: (value: string) => Promise<boolean>
    isSaving: boolean
}

/** Saves the holding message of a chatbot. */
export const useSaveReply = (installationId: string): SaveReplyView => {
    const settingSaved = useSettingSaved()
    const saveHolding = useMutateSaveHoldingMessageSwr()
    const holding = useCallback(
        (value: string): Promise<boolean> => settingSaved(() => saveHolding.trigger({ installationId, value })),
        [installationId, settingSaved, saveHolding],
    )
    return { holding, isSaving: saveHolding.isMutating }
}
