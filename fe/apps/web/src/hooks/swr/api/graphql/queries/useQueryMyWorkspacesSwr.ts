"use client"

import useSWR from "swr"
import { queryMyWorkspaces } from "@/modules/api/graphql/queries/query-my-workspaces"

/** The SWR key of the workspaces list; mutations that change it call `mutate(QUERY_MY_WORKSPACES_SWR_KEY)`. */
export const QUERY_MY_WORKSPACES_SWR_KEY = "QUERY_MY_WORKSPACES_SWR"

/** The workspaces the signed-in person belongs to, each with their membership (the back end `myWorkspaces` query). */
export const useQueryMyWorkspacesSwr = () =>
    useSWR(QUERY_MY_WORKSPACES_SWR_KEY, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryMyWorkspaces({ signal })
        if (!result.data) throw new Error("myWorkspaces answered no data")
        return result.data.myWorkspaces
    })
