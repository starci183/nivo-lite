import { mutateUpdateProfile } from "@/modules/api/graphql/mutations/mutation-update-profile"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the updateProfile mutation. */
export const MUTATE_UPDATE_PROFILE_SWR_KEY = "MUTATE_UPDATE_PROFILE_SWR"

/** SWR mutation for {@link mutateUpdateProfile}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateProfileSwr = () =>
    useGraphQLMutationSwr(MUTATE_UPDATE_PROFILE_SWR_KEY, mutateUpdateProfile, (data) => data.updateProfile)
