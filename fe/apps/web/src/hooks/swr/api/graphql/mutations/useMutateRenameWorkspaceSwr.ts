"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRenameWorkspace,
    type mutateRenameWorkspace as MutateRenameWorkspaceOperation,
} from "@/modules/api/graphql/mutations/mutation-rename-workspace"
import { answeredData } from "@/hooks/workspaceread"
import { GraphQLHeadersKey, type RenameWorkspaceMutation } from "@/modules/api"

/** The SWR key of the renameWorkspace mutation. */
export const MUTATE_RENAME_WORKSPACE_SWR_KEY = "MUTATE_RENAME_WORKSPACE_SWR"

/** The workspace a lobby command acts on (sent as `X-Workspace-Id`, the lobby has no workspace in its address), and its input. */
interface LobbyArg {
    readonly workspaceId: string
    readonly request: Parameters<typeof MutateRenameWorkspaceOperation>[0]["request"]
}

/** SWR mutation that renames a workspace from the lobby. */
export const useMutateRenameWorkspaceSwr = (): SWRMutationResponse<
    RenameWorkspaceMutation["renameWorkspace"],
    Error,
    typeof MUTATE_RENAME_WORKSPACE_SWR_KEY,
    LobbyArg
> =>
    useSWRMutation(
        MUTATE_RENAME_WORKSPACE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateRenameWorkspace({
                    request: arg.request,
                    headers: { [GraphQLHeadersKey.XWorkspaceId]: arg.workspaceId },
                }),
                MUTATE_RENAME_WORKSPACE_SWR_KEY,
            ).renameWorkspace,
    )

/** The argument this operation trigger takes. */
interface TriggerArg {
    readonly arg: LobbyArg
}
