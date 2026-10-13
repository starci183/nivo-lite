import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryAuthority } from "@/modules/api/graphql/queries/query-authority"

/** The SWR key of {@link useQueryAuthoritySwr}. */
export const QUERY_AUTHORITY_SWR_KEY = "QUERY_AUTHORITY_SWR"

/** The back end `authority` query. */
export const useQueryAuthoritySwr = (config?: SWRConfiguration) =>
    useSWR(
        QUERY_AUTHORITY_SWR_KEY,
        async () => {
            const result = await queryAuthority()
            if (!result.data) throw new Error("authority answered no data")
            return result.data.authority
        },
        config,
    )
