import useSWRMutation from "swr/mutation"
import { mutateDecideSetupCard } from "@/modules/api/graphql/mutations/mutation-decide-setup-card"
import type { MutateDecideSetupCardRequest } from "@/modules/api/graphql/mutations/mutation-decide-setup-card"

/** What the DecideSetupCard mutation is triggered with. */
interface DecideSetupCardArg {
    readonly arg: MutateDecideSetupCardRequest
}

/** The SWR key of {@link useMutateDecideSetupCardSwr}. */
export const MUTATE_DECIDE_SETUP_CARD_SWR_KEY = "MUTATE_DECIDE_SETUP_CARD_SWR"

/** SWR mutation for {@link mutateDecideSetupCard}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateDecideSetupCardSwr = () =>
    useSWRMutation(MUTATE_DECIDE_SETUP_CARD_SWR_KEY, async (_key: string, { arg }: DecideSetupCardArg) => {
        const result = await mutateDecideSetupCard({ request: arg })
        if (!result.data) throw new Error("decideSetupCard answered no data")
        return result.data.decideSetupCard
    })
