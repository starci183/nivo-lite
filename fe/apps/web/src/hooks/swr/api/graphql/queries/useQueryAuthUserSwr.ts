"use client"

import { sessionUser } from "@/modules/auth"
import useSWR from "swr"
import { useViewerKey } from "@/hooks/workspaceKey"

/** The SWR key of the signed-in user. */
export const AUTH_USER_SWR_KEY = "AUTH_USER_SWR"

/** The signed-in person of the browser session (id and e-mail); `undefined` while loading or when signed out. */
export const useQueryAuthUserSwr = () => useSWR(useViewerKey(AUTH_USER_SWR_KEY), sessionUser)
