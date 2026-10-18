"use client"

import { useCallback } from "react"
import { mutate } from "swr"
import { QUERY_MODULE_INSTALLATIONS_SWR_KEY, QUERY_SETUP_STATE_SWR_KEY } from "@/hooks/swr"

const KEYS: ReadonlyArray<string> = [QUERY_MODULE_INSTALLATIONS_SWR_KEY, QUERY_SETUP_STATE_SWR_KEY]

const isInstallationKey = (key: unknown): boolean =>
    typeof key === "string" ? KEYS.includes(key) : Array.isArray(key) && KEYS.includes(key[0])

/** Reads the installations (the frame of the agent and its tabs draw from them) and the setup of the active workspace again. */
export const useRefreshInstallation = (): (() => Promise<void>) =>
    useCallback(async () => {
        await mutate(isInstallationKey)
    }, [])
