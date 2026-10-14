"use client"

import { useEffect } from "react"
import { navigation } from "@/modules/i18n"
import { AUTH_ROUTES } from "@/modules/routes"
import { useAuthUser } from "./useAuthUser"

/** Sends a visitor who already has a session on from a public sign-in page: to `next` when there is one, else to the workspaces home. */
export const useRedirectWhenSignedIn = (next: string | undefined): void => {
    const router = navigation.useRouter()
    const { data: user } = useAuthUser()
    const signedIn = user !== undefined && user !== null
    useEffect(() => {
        if (signedIn) router.replace(next ?? AUTH_ROUTES.workspaces)
    }, [signedIn, next, router])
}
