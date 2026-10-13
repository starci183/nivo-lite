import useSWRMutation from "swr/mutation"
import { mutateDeleteHiringCandidate } from "@/modules/api/graphql/mutations/mutation-delete-hiring-candidate"
import type { MutateDeleteHiringCandidateRequest } from "@/modules/api/graphql/mutations/mutation-delete-hiring-candidate"

/** What the deleteHiringCandidate mutation is triggered with. */
interface DeleteHiringCandidateArg {
    readonly arg: MutateDeleteHiringCandidateRequest
}

/** The SWR key of the `deleteHiringCandidate` mutation. */
export const MUTATE_DELETE_HIRING_CANDIDATE_SWR_KEY = "MUTATE_DELETE_HIRING_CANDIDATE_SWR"

/** SWR mutation for {@link mutateDeleteHiringCandidate}: `trigger(request)` answers `deleteHiringCandidate` and rejects with the back end failure. */
export const useMutateDeleteHiringCandidateSwr = () =>
    useSWRMutation(MUTATE_DELETE_HIRING_CANDIDATE_SWR_KEY, async (_key: string, { arg }: DeleteHiringCandidateArg) => {
        const result = await mutateDeleteHiringCandidate({ request: arg })
        if (!result.data) throw new Error("deleteHiringCandidate answered no data")
        return result.data.deleteHiringCandidate
    })
