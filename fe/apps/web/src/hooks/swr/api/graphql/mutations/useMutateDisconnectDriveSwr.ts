"use client"

import useSWRMutation from "swr/mutation"
import { mutateDisconnectDrive } from "@/modules/api/graphql/mutations/mutation-disconnect-drive"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the disconnectDrive mutation. */
export const MUTATE_DISCONNECT_DRIVE_SWR_KEY = "MUTATE_DISCONNECT_DRIVE_SWR"

/** SWR mutation for {@link mutateDisconnectDrive}: `trigger()` forgets the Drive grant and rejects with the back end failure. */
export const useMutateDisconnectDriveSwr = (): SWRMutationResponse<
    OperationData<typeof mutateDisconnectDrive>["disconnectDrive"],
    Error,
    typeof MUTATE_DISCONNECT_DRIVE_SWR_KEY,
    never
> =>
    useSWRMutation(MUTATE_DISCONNECT_DRIVE_SWR_KEY, async () => {
        const { data } = await mutateDisconnectDrive({})
        const forgotten = data?.disconnectDrive
        if (forgotten === undefined) throw new Error("disconnectDrive answered no data")
        return forgotten
    })
