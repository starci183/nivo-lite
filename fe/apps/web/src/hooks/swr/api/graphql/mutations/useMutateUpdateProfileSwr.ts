"use client"

import { mutateUpdateProfile } from "@/modules/api/graphql/mutations/mutation-update-profile"
import type { mutateUpdateProfile as MutateUpdateProfileOperation } from "@/modules/api/graphql/mutations/mutation-update-profile"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the updateProfile mutation. */
export const MUTATE_UPDATE_PROFILE_SWR_KEY = "MUTATE_UPDATE_PROFILE_SWR"

/** SWR mutation for {@link mutateUpdateProfile}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateProfileSwr = () =>
    useSWRMutation(
        MUTATE_UPDATE_PROFILE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateUpdateProfile({ request: arg }), MUTATE_UPDATE_PROFILE_SWR_KEY).updateProfile,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateUpdateProfileOperation>[0]["request"]
}
