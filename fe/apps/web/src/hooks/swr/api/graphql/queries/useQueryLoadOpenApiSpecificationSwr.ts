"use client"

import useSWRMutation from "swr/mutation"
import { queryLoadOpenApiSpec } from "@/modules/api/graphql/queries/query-load-open-api-specification"

/** What the loadOpenApiSpec query is triggered with. */
interface LoadOpenApiSpecificationArg {
    readonly arg: Parameters<typeof queryLoadOpenApiSpec>[0]["request"]
}

/** The SWR key of the loadOpenApiSpec query from a link or pasted text. */
export const QUERY_LOAD_OPEN_API_SPECIFICATION_SWR_KEY = "QUERY_LOAD_OPEN_API_SPECIFICATION_SWR"

/** Lazy SWR query for {@link queryLoadOpenApiSpec}: `trigger(input)` answers the specification and rejects with the back end failure. */
export const useQueryLoadOpenApiSpecificationSwr = () =>
    useSWRMutation(
        QUERY_LOAD_OPEN_API_SPECIFICATION_SWR_KEY,
        async (_key: string, { arg }: LoadOpenApiSpecificationArg) => {
            const result = await queryLoadOpenApiSpec({ request: arg })
            if (result.data === undefined || result.data === null) throw new Error("loadOpenApiSpec answered no data")
            return result.data.loadOpenApiSpec
        },
    )
