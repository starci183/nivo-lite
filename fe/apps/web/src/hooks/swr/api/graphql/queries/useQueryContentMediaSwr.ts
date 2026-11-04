"use client"

import { answeredData, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRResponse } from "swr"
import { queryContentMedia, type QueryContentMediaRequest } from "@/modules/api/graphql/queries/query-content-media"
import type { ContentMediaQuery } from "@/modules/api"

/** The SWR key of the contentMedia query. */
export const QUERY_CONTENT_MEDIA_SWR_KEY = "QUERY_CONTENT_MEDIA_SWR"

/** The media of one content item. */
export const useQueryContentMediaSwr = (
    request: QueryContentMediaRequest | undefined,
): SWRResponse<ContentMediaQuery["contentMedia"], Error> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_CONTENT_MEDIA_SWR_KEY, request ? ([request] as const) : null),
        async ([, , ...input]: WorkspaceReadKey<QueryContentMediaRequest>) =>
            answeredData(await queryContentMedia({ request: input[0] }), QUERY_CONTENT_MEDIA_SWR_KEY).contentMedia,
    )
