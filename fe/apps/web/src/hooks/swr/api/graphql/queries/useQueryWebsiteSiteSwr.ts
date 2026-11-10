"use client"

import useSWR from "swr"
import { workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryWebsiteSite } from "@/modules/api/graphql/queries/query-website-site"
import type { WebsiteSiteQuery } from "@/modules/api"

/** The identity of the website intake cache. */
export const QUERY_WEBSITE_SITE_SWR_KEY = "QUERY_WEBSITE_SITE_SWR"

/** Reads the website intake once the drawer that shows it is open (the first read issues the key); `isOpen` false reads nothing. */
export const useQueryWebsiteSiteSwr = (
    workspaceId: string | undefined,
    isOpen: boolean,
): ReadResponse<WebsiteSiteQuery["websiteSite"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_WEBSITE_SITE_SWR_KEY, workspaceId, isOpen ? true : undefined),
        async ([, scope]: WorkspaceReadKey<boolean>) => {
            const result = await queryWebsiteSite({ headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("websiteSite answered no data")
            return result.data.websiteSite
        },
    )
