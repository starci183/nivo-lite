"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryWebsiteSite } from "@/modules/api/graphql/queries/query-website-site"
import type { WebsiteSiteQuery } from "@/modules/api"

/** The SWR key of the website intake of the workspace. */
export const QUERY_WEBSITE_SITE_SWR_KEY = "QUERY_WEBSITE_SITE_SWR"

/** The website intake of the workspace (the back end `websiteSite` query); the first read issues the site key. */
export const useQueryWebsiteSiteSwr = (): ReadResponse<WebsiteSiteQuery["websiteSite"]> =>
    useSWR(
        useWorkspaceKey(QUERY_WEBSITE_SITE_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryWebsiteSite({ signal }), "websiteSite").websiteSite,
        { errorRetryCount: 1, revalidateOnFocus: false },
    )
