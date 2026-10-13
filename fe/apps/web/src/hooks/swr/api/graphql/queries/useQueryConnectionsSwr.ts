import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryConnections } from "@/modules/api/graphql/queries/query-connections"

/** The SWR key of {@link useQueryConnectionsSwr}. */
export const QUERY_CONNECTIONS_SWR_KEY = "QUERY_CONNECTIONS_SWR"

/** The back end `connections` query. */
export const useQueryConnectionsSwr = (config?: SWRConfiguration) =>
    useSWR(QUERY_CONNECTIONS_SWR_KEY, async () => (await queryConnections()).data?.connections, config)
