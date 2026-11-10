"use client"

import { useState } from "react"

/** The dialogs of the rights tab: whether the attach drawer is open and which provider is picked, and which provider waits for the remove confirm. */
interface ProviderDialogs {
    readonly isDrawerOpen: boolean
    readonly setIsDrawerOpen: (isOpen: boolean) => void
    readonly picked: string | null
    readonly setPicked: (provider: string | null) => void
    readonly detachKey: string | null
    readonly setDetachKey: (provider: string | null) => void
}

/** The state of the attach drawer and the remove confirm of the rights tab. */
export const useProviderDialogs = (): ProviderDialogs => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [picked, setPicked] = useState<string | null>(null)
    const [detachKey, setDetachKey] = useState<string | null>(null)
    return { isDrawerOpen, setIsDrawerOpen, picked, setPicked, detachKey, setDetachKey }
}
