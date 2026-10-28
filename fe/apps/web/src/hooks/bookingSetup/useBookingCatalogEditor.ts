"use client"

import { useState, useTransition } from "react"

/**
 * The editing state of a setup catalogue (the resources, the services): the one entry whose form is open, the one waiting for a
 * removal yes, and the transition the writes run in.
 */
export const useBookingCatalogEditor = <D>() => {
    const [draft, setDraft] = useState<D | null>(null)
    const [removeId, setRemoveId] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    return { draft, setDraft, removeId, setRemoveId, isPending, startTransition }
}
