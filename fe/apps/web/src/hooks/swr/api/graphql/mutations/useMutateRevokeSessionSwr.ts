import { mutateRevokeSession } from "@/modules/api/graphql/mutations/mutation-revoke-session"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the revokeSession mutation. */
export const MUTATE_REVOKE_SESSION_SWR_KEY = "MUTATE_REVOKE_SESSION_SWR"

/** SWR mutation for {@link mutateRevokeSession}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevokeSessionSwr = () =>
    useGraphQLMutationSwr(MUTATE_REVOKE_SESSION_SWR_KEY, mutateRevokeSession, (data) => data.revokeSession)
