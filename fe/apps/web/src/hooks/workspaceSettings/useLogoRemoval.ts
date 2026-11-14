"use client"

import { useState } from "react"
/** What removing the logo needs: the command that removes it. */
interface LogoRemover {
    readonly remove: () => Promise<void>
}

/** The view `useLogoRemoval` returns. */
export interface LogoRemovalView {
    /** The question about removing the logo is open. */
    isAsking: boolean
    ask: () => void
    cancel: () => void
    /** Removes the logo, then closes the question. */
    confirm: () => Promise<void>
}

/** The question asked before the workspace logo is removed: it opens, is cancelled, or removes the logo and closes. */
export const useLogoRemoval = (logo: LogoRemover): LogoRemovalView => {
    const [isAsking, setIsAsking] = useState(false)
    return {
        isAsking,
        ask: () => setIsAsking(true),
        cancel: () => setIsAsking(false),
        confirm: async () => {
            await logo.remove()
            setIsAsking(false)
        },
    }
}
