"use client"

import { useEffect } from "react"
import { useSWRConfig } from "swr"
import { subscribeToAuthChange } from "@/modules/auth"
import { navigation } from "@/modules/i18n"

/** Events after which the cached API data belongs to another person (or to nobody). */
const IDENTITY_EVENTS: ReadonlySet<string> = new Set(["SIGNED_IN", "SIGNED_OUT"])

/**
 * Follows the browser Supabase session: when the person signs in or out it drops every cached API answer, and on any session
 * change it re-renders the server tree (the proxy gates routes on the session cookie). Renders nothing.
 */
export const AuthSideEffect = () => {
    const router = navigation.useRouter()
    const { mutate } = useSWRConfig()
    useEffect(
        () =>
            subscribeToAuthChange((event) => {
                if (IDENTITY_EVENTS.has(event)) void mutate(() => true, undefined, { revalidate: false })
                router.refresh()
            }),
        [mutate, router],
    )
    return null
}
