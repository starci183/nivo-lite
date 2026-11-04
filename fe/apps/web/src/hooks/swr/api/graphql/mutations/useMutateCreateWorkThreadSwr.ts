"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateCreateWorkThread,
    type MutateCreateWorkThreadRequest,
} from "@/modules/api/graphql/mutations/mutation-create-work-thread"
import type { SWRMutationResponse } from "swr/mutation"
import type { CreateWorkThreadMutation } from "@/modules/api"

/** What the CreateWorkThread mutation is triggered with. */
interface CreateWorkThreadArg {
    readonly arg: MutateCreateWorkThreadRequest
}

/** The SWR key of {@link useMutateCreateWorkThreadSwr}. */
export const MUTATE_CREATE_WORK_THREAD_SWR_KEY = "MUTATE_CREATE_WORK_THREAD_SWR"

/** SWR mutation for {@link mutateCreateWorkThread}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCreateWorkThreadSwr = (): SWRMutationResponse<
    CreateWorkThreadMutation["createWorkThread"],
    Error,
    typeof MUTATE_CREATE_WORK_THREAD_SWR_KEY,
    CreateWorkThreadArg["arg"]
> =>
    useSWRMutation(MUTATE_CREATE_WORK_THREAD_SWR_KEY, async (_key: string, { arg }: CreateWorkThreadArg) => {
        const result = await mutateCreateWorkThread({ request: arg })
        if (!result.data) throw new Error("createWorkThread answered no data")
        return result.data.createWorkThread
    })
