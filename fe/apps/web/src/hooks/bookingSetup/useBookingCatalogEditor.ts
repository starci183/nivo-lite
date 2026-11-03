"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useState, type Dispatch, type SetStateAction } from "react"
import { useBookingTransition } from "@/hooks/bookingDesk"

/**
 * The editing state of a setup catalogue (the resources, the services): the one entry whose form is open, the one waiting for a
 * removal yes, and the transition the writes run in.
 */
export const useBookingCatalogEditor = <D>(
    isActive = true,
    scope = "",
): {
    draft: D | null
    setDraft: Dispatch<SetStateAction<D | null>>
    removeId: string | null
    setRemoveId: Dispatch<SetStateAction<string | null>>
    isPending: boolean
    startTransition: (job: (isCurrent: () => boolean) => Promise<void>) => void
} => {
    const [draft, setDraft] = useState<D | null>(null)
    const [removeId, setRemoveId] = useState<string | null>(null)
    const transition = useBookingTransition(isActive, scope)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setDraft(null)
            setRemoveId(null)
        },
    })
    return { draft, setDraft, removeId, setRemoveId, isPending: transition.isPending, startTransition: transition.run }
}
