"use client"

import { useEffect, useRef } from "react"
import { useSWRConfig } from "swr"
import { subscribeToAuthChange } from "@/modules/auth-session"
import { navigation } from "@/modules/i18n"
import { setViewerId, useAppDispatch } from "@/redux"

/** The person the console last saw: `undefined` before the first answer, `null` when nobody is signed in. */
type SeenUser = string | null | undefined

/**
 * Follows the browser session. Only a real change of identity (a different person, or sign-in and sign-out) drops every cached
 * API answer and re-renders the server tree (the proxy gates routes on the session cookie). A token refresh, the initial session and a
 * repeated sign-in of the same person (the browser re-announces it when a tab regains focus) answer the same person and change
 * nothing, so the console is not remounted by them; the very first answer only records the person. Renders nothing.
 */
export const AuthSideEffect = () => {
    const router = navigation.useRouter()
    const dispatch = useAppDispatch()
    const { mutate } = useSWRConfig()
    const seen = useRef<SeenUser>(undefined)
    useEffect(
        () =>
            subscribeToAuthChange((userId) => {
                dispatch(setViewerId(userId))
                const previous = seen.current
                seen.current = userId
                // The first answer only records who is signed in.
                if (previous === undefined || previous === userId) return
                // Drop the answers without refetching them: the per-viewer cache and the server refresh own what comes next.
                void mutate(() => true, undefined, { revalidate: false })
                router.refresh()
            }),
        [dispatch, mutate, router],
    )
    return null
}
