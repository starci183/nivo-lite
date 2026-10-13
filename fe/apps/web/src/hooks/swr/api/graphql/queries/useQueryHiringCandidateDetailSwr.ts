import useSWR from "swr"
import { queryHiringCandidateDetail } from "@/modules/api/graphql/queries/query-hiring-candidate-detail"
import type { QueryHiringCandidateDetailRequest } from "@/modules/api/graphql/queries/query-hiring-candidate-detail"

/** The SWR key of the `hiringCandidateDetail` query. */
export const QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY = "QUERY_HIRING_CANDIDATE_DETAIL_SWR"

/** The `hiringCandidateDetail` query through SWR; `undefined` suspends the read. */
export const useQueryHiringCandidateDetailSwr = (request: QueryHiringCandidateDetailRequest | undefined) =>
    useSWR(request === undefined ? null : [QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY, request], async ([, req]) => {
        const result = await queryHiringCandidateDetail({ request: req })
        if (!result.data) throw new Error("hiringCandidateDetail answered no data")
        return result.data.hiringCandidateDetail
    })
