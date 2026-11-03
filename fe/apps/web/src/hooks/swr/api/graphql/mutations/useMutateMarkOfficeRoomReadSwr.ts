"use client"

import useSWRMutation from "swr/mutation"
import { mutateMarkOfficeRoomRead } from "@/modules/api/graphql/mutations/mutation-mark-office-room-read"
import type { MutateMarkOfficeRoomReadRequest } from "@/modules/api/graphql/mutations/mutation-mark-office-room-read"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the MarkOfficeRoomRead mutation is triggered with. */
interface MarkOfficeRoomReadArg {
    readonly arg: MutateMarkOfficeRoomReadRequest
}

/** The SWR key of {@link useMutateMarkOfficeRoomReadSwr}. */
export const MUTATE_MARK_OFFICE_ROOM_READ_SWR_KEY = "MUTATE_MARK_OFFICE_ROOM_READ_SWR"

/** SWR mutation for {@link mutateMarkOfficeRoomRead}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateMarkOfficeRoomReadSwr = (): SWRMutationResponse<
    OperationData<typeof mutateMarkOfficeRoomRead>["markOfficeRoomRead"],
    Error,
    typeof MUTATE_MARK_OFFICE_ROOM_READ_SWR_KEY,
    MarkOfficeRoomReadArg["arg"]
> =>
    useSWRMutation(MUTATE_MARK_OFFICE_ROOM_READ_SWR_KEY, async (_key: string, { arg }: MarkOfficeRoomReadArg) => {
        const result = await mutateMarkOfficeRoomRead({ request: arg })
        if (!result.data) throw new Error("markOfficeRoomRead answered no data")
        return result.data.markOfficeRoomRead
    })
