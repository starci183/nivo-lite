import useSWRMutation from "swr/mutation"
import { mutateSetConnectionGrant } from "@/modules/api/graphql/mutations/mutation-set-connection-grant"
import type { MutateSetConnectionGrantRequest } from "@/modules/api/graphql/mutations/mutation-set-connection-grant"

/** What the setConnectionGrant mutation is triggered with. */
interface SetConnectionGrantArg {
    readonly arg: MutateSetConnectionGrantRequest
}

/** The SWR key of the setConnectionGrant mutation. */
export const MUTATE_SET_CONNECTION_GRANT_SWR_KEY = "MUTATE_SET_CONNECTION_GRANT_SWR"

/** SWR mutation for {@link mutateSetConnectionGrant}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetConnectionGrantSwr = () =>
    useSWRMutation(MUTATE_SET_CONNECTION_GRANT_SWR_KEY, async (_key: string, { arg }: SetConnectionGrantArg) => {
        const result = await mutateSetConnectionGrant({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("setConnectionGrant answered no data")
        return result.data.setConnectionGrant
    })
