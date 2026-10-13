import { queryContentMedia } from "@/modules/api/graphql/queries/query-content-media"
import type { QueryContentMediaRequest } from "@/modules/api/graphql/queries/query-content-media"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables"

/** The SWR key of the contentMedia query. */
export const QUERY_CONTENT_MEDIA_SWR_KEY = "QUERY_CONTENT_MEDIA_SWR"

/** The media of one content item. */
export const useQueryContentMediaSwr = (request: QueryContentMediaRequest | undefined) =>
    useWorkspaceQuerySwr(
        QUERY_CONTENT_MEDIA_SWR_KEY,
        request ? [request] : null,
        ([input]) => queryContentMedia({ request: input }),
        (data) => data.contentMedia,
    )
