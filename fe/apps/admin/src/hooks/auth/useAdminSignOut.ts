"use client"

import { useTransition } from "react"
import { authClient } from "@/modules/auth"
import { consoleLoginUrl } from "@/modules/config"

/** What a sign-out control needs: the command that ends the session. */
export interface SignOut {
    readonly pending: boolean
    readonly signOut: () => void
}

/** Ends the session on the back end (it clears the shared cookie), then sends the person to the sign-in page of the console. */
export const useAdminSignOut = (): SignOut => {
    const [pending, startTransition] = useTransition()
    return {
        pending,
        signOut: () => {
            startTransition(async () => {
                await authClient.signOut()
                window.location.assign(consoleLoginUrl())
            })
        },
    }
}
