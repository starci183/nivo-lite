import useSWR from "swr"
import { queryPublicHiringInterview } from "@/modules/api/graphql/queries/query-public-hiring-interview"
import type { QueryPublicHiringInterviewRequest } from "@/modules/api/graphql/queries/query-public-hiring-interview"

/** The SWR key of the `publicHiringInterview` query. */
export const QUERY_PUBLIC_HIRING_INTERVIEW_SWR_KEY = "QUERY_PUBLIC_HIRING_INTERVIEW_SWR"

/** The `publicHiringInterview` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringInterviewSwr = (request: QueryPublicHiringInterviewRequest | undefined) =>
    useSWR(request === undefined ? null : [QUERY_PUBLIC_HIRING_INTERVIEW_SWR_KEY, request], async ([, req]) => {
        const result = await queryPublicHiringInterview({ request: req })
        if (!result.data) throw new Error("publicHiringInterview answered no data")
        return result.data.publicHiringInterview
    })
