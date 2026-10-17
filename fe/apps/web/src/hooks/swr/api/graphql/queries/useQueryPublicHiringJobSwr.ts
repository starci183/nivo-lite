"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryPublicHiringJob } from "@/modules/api/graphql/queries/query-public-hiring-job"
import type { QueryPublicHiringJobRequest } from "@/modules/api/graphql/queries/query-public-hiring-job"

/** The SWR key of the `publicHiringJob` query. */
export const QUERY_PUBLIC_HIRING_JOB_SWR_KEY = "QUERY_PUBLIC_HIRING_JOB_SWR"

/** The `publicHiringJob` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringJobSwr = (request: QueryPublicHiringJobRequest | undefined) =>
    useSWR(
        argumentKey(QUERY_PUBLIC_HIRING_JOB_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryPublicHiringJob({ request: input }), QUERY_PUBLIC_HIRING_JOB_SWR_KEY)
                .publicHiringJob,
    )
