import { useKeyedQuerySwr } from "@/hooks/reuseables"
import type { SWRConfiguration } from "swr"
import { queryMetaConnection } from "@/modules/api/graphql/queries/query-meta-connection"

/** The SWR key of the metaConnection query. */
export const QUERY_META_CONNECTION_SWR_KEY = "QUERY_META_CONNECTION_SWR"

/** The Meta wizard view of a connection (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryMetaConnectionSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useKeyedQuerySwr(
        QUERY_META_CONNECTION_SWR_KEY,
        connectionId,
        (id) => queryMetaConnection({ request: { connectionId: id } }),
        (data) => data.metaConnection,
        options,
    )
