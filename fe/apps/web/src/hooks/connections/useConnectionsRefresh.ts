"use client"

import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_CONNECTIONS_SWR_KEY } from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"

/** Reloads the connections of the workspace after something changed them. */
export const useConnectionsRefresh = () => useCallback(() => mutate(matchesSwrKey(QUERY_CONNECTIONS_SWR_KEY)), [])
