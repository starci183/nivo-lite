"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryPublicHiringInterview } from "@/modules/api/graphql/queries/query-public-hiring-interview"
import type { QueryPublicHiringInterviewRequest } from "@/modules/api/graphql/queries/query-public-hiring-interview"

/** The SWR key of the `publicHiringInterview` query. */
export const QUERY_PUBLIC_HIRING_INTERVIEW_SWR_KEY = "QUERY_PUBLIC_HIRING_INTERVIEW_SWR"

/** The `publicHiringInterview` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringInterviewSwr = (request: QueryPublicHiringInterviewRequest | undefined) =>
    useSWR(
        argumentKey(QUERY_PUBLIC_HIRING_INTERVIEW_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryPublicHiringInterview({ request: input }), QUERY_PUBLIC_HIRING_INTERVIEW_SWR_KEY)
                .publicHiringInterview,
    )
