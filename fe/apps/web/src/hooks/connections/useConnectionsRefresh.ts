"use client"

import { useCallback } from "react"
import { mutate } from "swr"
import { QUERY_CONNECTIONS_SWR_KEY } from "@/hooks/swr"

/** Reloads the connections of the workspace after something changed them. */
export const useConnectionsRefresh = () => useCallback(() => mutate(QUERY_CONNECTIONS_SWR_KEY), [])
