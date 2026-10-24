"use client"

import { useQueryLeadBoardSwr } from "./useQueryLeadBoardSwr"

/** The bounded customer directory used by the Office mention picker. */
export const QUERY_LEAD_DIRECTORY_SWR_KEY = "QUERY_LEAD_DIRECTORY_SWR"

/** Preserves the Office picker's previous capacity of 500 customers with at most ten bounded pages. */
export const useQueryLeadDirectorySwr = (workspaceId: string | undefined) =>
    useQueryLeadBoardSwr(workspaceId, { cacheKey: QUERY_LEAD_DIRECTORY_SWR_KEY, initialSize: 10 })
