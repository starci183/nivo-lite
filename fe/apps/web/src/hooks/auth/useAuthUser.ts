"use client"

import useSWR from "swr"
import { sessionUser } from "@/modules/auth"

/** The SWR key of the signed-in user. */
export const AUTH_USER_SWR_KEY = "AUTH_USER_SWR"

/** The signed-in person of the browser session (id and e-mail); `undefined` while loading or when signed out. */
export const useAuthUser = () => useSWR(AUTH_USER_SWR_KEY, sessionUser)
