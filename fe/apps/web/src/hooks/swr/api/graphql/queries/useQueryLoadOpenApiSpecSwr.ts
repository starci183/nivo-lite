"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLoadOpenApiSpec } from "@/modules/api/graphql/queries/query-load-open-api-specification"

/** The SWR key of the loadOpenApiSpec query read from a spec link. */
const QUERY_LOAD_OPEN_API_SPEC_SWR_KEY = "QUERY_LOAD_OPEN_API_SPEC_SWR"

/** The spec behind a link, read by the back end (a reopened API connection refreshes its operations). `undefined` pauses it. */
export const useQueryLoadOpenApiSpecSwr = (specUrl: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_LOAD_OPEN_API_SPEC_SWR_KEY, specUrl),
        async ([, url]) => {
            const result = await queryLoadOpenApiSpec({ request: { specUrl: url, specText: "" } })
            if (!result.data) throw new Error("loadOpenApiSpec answered no data")
            return result.data.loadOpenApiSpec
        },
        options,
    )
