"use client"

import useSWRMutation from "swr/mutation"
import { mutateAuthorizeDrive } from "@/modules/api/graphql/mutations/mutation-authorize-drive"
import type { MutateAuthorizeDriveRequest } from "@/modules/api/graphql/mutations/mutation-authorize-drive"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the authorizeDrive mutation is triggered with. */
interface AuthorizeDriveArg {
    readonly arg: MutateAuthorizeDriveRequest
}

/** The SWR key of the authorizeDrive mutation. */
export const MUTATE_AUTHORIZE_DRIVE_SWR_KEY = "MUTATE_AUTHORIZE_DRIVE_SWR"

/** SWR mutation for {@link mutateAuthorizeDrive}: `trigger(input)` answers the consent url and rejects with the back end failure. */
export const useMutateAuthorizeDriveSwr = (): SWRMutationResponse<
    OperationData<typeof mutateAuthorizeDrive>["authorizeDrive"],
    Error,
    typeof MUTATE_AUTHORIZE_DRIVE_SWR_KEY,
    AuthorizeDriveArg["arg"]
> =>
    useSWRMutation(MUTATE_AUTHORIZE_DRIVE_SWR_KEY, async (_key: string, { arg }: AuthorizeDriveArg) => {
        const { data } = await mutateAuthorizeDrive({ request: arg })
        const started = data?.authorizeDrive
        if (started === undefined) throw new Error("authorizeDrive answered no data")
        return started
    })
