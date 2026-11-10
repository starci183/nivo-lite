"use client"

import { useState } from "react"

/** The dialogs of the rights tab: whether the attach drawer is open, and which account waits for the remove confirm. */
interface ProviderDialogs {
    readonly isDrawerOpen: boolean
    readonly setIsDrawerOpen: (isOpen: boolean) => void
    readonly detachKey: string | null
    readonly setDetachKey: (connectionId: string | null) => void
}

/** The state of the attach drawer and the remove confirm of the rights tab. */
export const useProviderDialogs = (): ProviderDialogs => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [detachKey, setDetachKey] = useState<string | null>(null)
    return { isDrawerOpen, setIsDrawerOpen, detachKey, setDetachKey }
}
