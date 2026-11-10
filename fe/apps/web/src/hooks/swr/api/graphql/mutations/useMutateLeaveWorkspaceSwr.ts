"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import { mutateLeaveWorkspace } from "@/modules/api/graphql/mutations/mutation-leave-workspace"
import { answeredData } from "@/hooks/workspaceread"
import { GraphQLHeadersKey } from "@/modules/api"
import type { LeaveWorkspaceMutation } from "@/modules/api"

/** The SWR key of the leaveWorkspace mutation. */
export const MUTATE_LEAVE_WORKSPACE_SWR_KEY = "MUTATE_LEAVE_WORKSPACE_SWR"

/** The workspace a lobby command acts on (sent as `X-Workspace-Id`, the lobby has no workspace in its address). */
interface LobbyArg {
    readonly workspaceId: string
}

/** SWR mutation that takes the signed-in person out of a workspace from the lobby. */
export const useMutateLeaveWorkspaceSwr = (): SWRMutationResponse<
    LeaveWorkspaceMutation["leaveWorkspace"],
    Error,
    typeof MUTATE_LEAVE_WORKSPACE_SWR_KEY,
    LobbyArg
> =>
    useSWRMutation(
        MUTATE_LEAVE_WORKSPACE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateLeaveWorkspace({ headers: { [GraphQLHeadersKey.XWorkspaceId]: arg.workspaceId } }),
                MUTATE_LEAVE_WORKSPACE_SWR_KEY,
            ).leaveWorkspace,
    )

/** The argument this operation trigger takes. */
interface TriggerArg {
    readonly arg: LobbyArg
}
