"use client"

import useSWR, { type SWRResponse } from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryWebsiteTheme } from "@/modules/api/graphql/queries/query-website-theme"
import type { WebsiteThemeQuery } from "@/modules/api"

/** The SWR key of the websiteTheme query. */
const QUERY_WEBSITE_THEME_SWR_KEY = "QUERY_WEBSITE_THEME_SWR"

/** The theme parameters behind a site key (anonymous); null while the workspace wears the NIVO default. */
export const useQueryWebsiteThemeSwr = (siteKey: string): SWRResponse<WebsiteThemeQuery["websiteTheme"], Error> =>
    useSWR([QUERY_WEBSITE_THEME_SWR_KEY, siteKey], async () =>
        answeredData(await queryWebsiteTheme({ request: { siteKey } }), QUERY_WEBSITE_THEME_SWR_KEY).websiteTheme,
    )
