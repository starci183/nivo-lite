"use client"

import { sessionUser } from "@/modules/auth-session"
import useSWR from "swr"
import { useViewerKey } from "@/hooks/workspaceKey"
import type { ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the signed-in user. */
export const AUTH_USER_SWR_KEY = "AUTH_USER_SWR"

/** The signed-in person of the browser session (id and e-mail); `undefined` while loading or when signed out. */
export const useQueryAuthUserSwr = (): ReadResponse<Awaited<ReturnType<typeof sessionUser>>> =>
    useSWR(useViewerKey(AUTH_USER_SWR_KEY), sessionUser)
