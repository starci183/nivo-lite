import { useKeyedQuerySwr } from "@/hooks/reuseables"
import { queryHiringCandidateDetail } from "@/modules/api/graphql/queries/query-hiring-candidate-detail"
import type { QueryHiringCandidateDetailRequest } from "@/modules/api/graphql/queries/query-hiring-candidate-detail"

/** The SWR key of the `hiringCandidateDetail` query. */
export const QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY = "QUERY_HIRING_CANDIDATE_DETAIL_SWR"

/** The `hiringCandidateDetail` query through SWR; `undefined` suspends the read. */
export const useQueryHiringCandidateDetailSwr = (request: QueryHiringCandidateDetailRequest | undefined) =>
    useKeyedQuerySwr(
        QUERY_HIRING_CANDIDATE_DETAIL_SWR_KEY,
        request,
        (input) => queryHiringCandidateDetail({ request: input }),
        (data) => data.hiringCandidateDetail,
    )
