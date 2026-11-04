"use client"

import {
    mutateRevokeSession,
    type mutateRevokeSession as MutateRevokeSessionOperation,
} from "@/modules/api/graphql/mutations/mutation-revoke-session"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { RevokeSessionMutation } from "@/modules/api"

/** The SWR key of the revokeSession mutation. */
export const MUTATE_REVOKE_SESSION_SWR_KEY = "MUTATE_REVOKE_SESSION_SWR"

/** SWR mutation for {@link mutateRevokeSession}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevokeSessionSwr = (): SWRMutationResponse<
    RevokeSessionMutation["revokeSession"],
    Error,
    typeof MUTATE_REVOKE_SESSION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REVOKE_SESSION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRevokeSession({ request: arg }), MUTATE_REVOKE_SESSION_SWR_KEY).revokeSession,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRevokeSessionOperation>[0]["request"]
}
