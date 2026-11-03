"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { queryContentMedia } from "@/modules/api/graphql/queries/query-content-media"
import type { QueryContentMediaRequest } from "@/modules/api/graphql/queries/query-content-media"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the contentMedia query. */
export const QUERY_CONTENT_MEDIA_SWR_KEY = "QUERY_CONTENT_MEDIA_SWR"

/** The media of one content item. */
export const useQueryContentMediaSwr = (
    request: QueryContentMediaRequest | undefined,
): ReadResponse<OperationData<typeof queryContentMedia>["contentMedia"]> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_CONTENT_MEDIA_SWR_KEY, request ? ([request] as const) : null),
        async ([, , ...input]: WorkspaceReadKey<QueryContentMediaRequest>) =>
            answeredData(await queryContentMedia({ request: input[0] }), QUERY_CONTENT_MEDIA_SWR_KEY).contentMedia,
    )
