import useSWRMutation from "swr/mutation"
import { mutateMoveHiringCandidate } from "@/modules/api/graphql/mutations/mutation-move-hiring-candidate"
import type { MutateMoveHiringCandidateRequest } from "@/modules/api/graphql/mutations/mutation-move-hiring-candidate"

/** What the moveHiringCandidate mutation is triggered with. */
interface MoveHiringCandidateArg {
    readonly arg: MutateMoveHiringCandidateRequest
}

/** The SWR key of the `moveHiringCandidate` mutation. */
export const MUTATE_MOVE_HIRING_CANDIDATE_SWR_KEY = "MUTATE_MOVE_HIRING_CANDIDATE_SWR"

/** SWR mutation for {@link mutateMoveHiringCandidate}: `trigger(request)` answers `moveHiringCandidate` and rejects with the back end failure. */
export const useMutateMoveHiringCandidateSwr = () =>
    useSWRMutation(MUTATE_MOVE_HIRING_CANDIDATE_SWR_KEY, async (_key: string, { arg }: MoveHiringCandidateArg) => {
        const result = await mutateMoveHiringCandidate({ request: arg })
        if (!result.data) throw new Error("moveHiringCandidate answered no data")
        return result.data.moveHiringCandidate
    })
