"use client"

import useSWRMutation from "swr/mutation"
import { mutateCreateWorkThread } from "@/modules/api/graphql/mutations/mutation-create-work-thread"
import type { MutateCreateWorkThreadRequest } from "@/modules/api/graphql/mutations/mutation-create-work-thread"

/** What the CreateWorkThread mutation is triggered with. */
interface CreateWorkThreadArg {
    readonly arg: MutateCreateWorkThreadRequest
}

/** The SWR key of {@link useMutateCreateWorkThreadSwr}. */
export const MUTATE_CREATE_WORK_THREAD_SWR_KEY = "MUTATE_CREATE_WORK_THREAD_SWR"

/** SWR mutation for {@link mutateCreateWorkThread}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateCreateWorkThreadSwr = () =>
    useSWRMutation(MUTATE_CREATE_WORK_THREAD_SWR_KEY, async (_key: string, { arg }: CreateWorkThreadArg) => {
        const result = await mutateCreateWorkThread({ request: arg })
        if (!result.data) throw new Error("createWorkThread answered no data")
        return result.data.createWorkThread
    })
