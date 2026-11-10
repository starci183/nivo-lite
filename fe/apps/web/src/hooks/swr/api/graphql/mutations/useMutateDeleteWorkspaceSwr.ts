"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import {
    mutateDeleteWorkspace,
    type mutateDeleteWorkspace as MutateDeleteWorkspaceOperation,
} from "@/modules/api/graphql/mutations/mutation-delete-workspace"
import { answeredData } from "@/hooks/workspaceread"
import { GraphQLHeadersKey } from "@/modules/api"
import type { DeleteWorkspaceMutation } from "@/modules/api"

/** The SWR key of the deleteWorkspace mutation. */
export const MUTATE_DELETE_WORKSPACE_SWR_KEY = "MUTATE_DELETE_WORKSPACE_SWR"

/** The workspace a lobby command acts on (sent as `X-Workspace-Id`, the lobby has no workspace in its address), and its input. */
interface LobbyArg {
    readonly workspaceId: string
    readonly request: Parameters<typeof MutateDeleteWorkspaceOperation>[0]["request"]
}

/** SWR mutation that deletes a workspace from the lobby, as its owner. */
export const useMutateDeleteWorkspaceSwr = (): SWRMutationResponse<
    DeleteWorkspaceMutation["deleteWorkspace"],
    Error,
    typeof MUTATE_DELETE_WORKSPACE_SWR_KEY,
    LobbyArg
> =>
    useSWRMutation(
        MUTATE_DELETE_WORKSPACE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateDeleteWorkspace({
                    request: arg.request,
                    headers: { [GraphQLHeadersKey.XWorkspaceId]: arg.workspaceId },
                }),
                MUTATE_DELETE_WORKSPACE_SWR_KEY,
            ).deleteWorkspace,
    )

/** The argument this operation trigger takes. */
interface TriggerArg {
    readonly arg: LobbyArg
}
