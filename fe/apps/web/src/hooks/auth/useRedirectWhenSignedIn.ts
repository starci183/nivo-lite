"use client"

import { useEffect } from "react"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { useQueryAuthUserSwr as useAuthUser } from "@/hooks/swr"

/** Sends a visitor who already has a session on from a public sign-in page: to `next` when there is one, else to the front address (the workspace opened last, else the workspaces page). */
export const useRedirectWhenSignedIn = (next: string | undefined): void => {
    const router = navigation.useRouter()
    const { data: user } = useAuthUser()
    const signedIn = user !== undefined && user !== null
    useEffect(() => {
        if (signedIn) router.replace(next ?? APP_ROUTES.home)
    }, [signedIn, next, router])
}
