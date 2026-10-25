"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetMyAvatar } from "@/modules/api/graphql/mutations/mutation-set-my-avatar"
import type { MutateSetMyAvatarRequest } from "@/modules/api/graphql/mutations/mutation-set-my-avatar"

/** What the SetMyAvatar mutation is triggered with. */
interface SetMyAvatarArg {
    readonly arg: MutateSetMyAvatarRequest
}

/** The SWR key of {@link useMutateSetMyAvatarSwr}. */
export const MUTATE_SET_MY_AVATAR_SWR_KEY = "MUTATE_SET_MY_AVATAR_SWR"

/** SWR mutation for {@link mutateSetMyAvatar}: `trigger(request)` answers true and rejects with the back end failure. */
export const useMutateSetMyAvatarSwr = () =>
    useSWRMutation(MUTATE_SET_MY_AVATAR_SWR_KEY, async (_key: string, { arg }: SetMyAvatarArg) => {
        const result = await mutateSetMyAvatar({ request: arg })
        if (!result.data) throw new Error("setMyAvatar answered no data")
        return result.data.setMyAvatar
    })
