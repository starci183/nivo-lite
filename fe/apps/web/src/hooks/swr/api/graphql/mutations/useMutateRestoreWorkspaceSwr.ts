"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateRestoreWorkspace } from "@/modules/api/graphql/mutations/mutation-restore-workspace"
import { answeredData } from "@/hooks/workspaceread"
import { GraphQLHeadersKey } from "@/modules/api"

/** The SWR key of the restoreWorkspace mutation. */
export const MUTATE_RESTORE_WORKSPACE_SWR_KEY = "MUTATE_RESTORE_WORKSPACE_SWR"

/** The deleted workspace to restore (sent as `X-Workspace-Id`: the lobby has no workspace in its address). */
interface TriggerArg {
    readonly arg: { readonly workspaceId: string }
}

/** Restores the workspace and answers whether the back end did. */
const restore = async (_key: string, { arg }: TriggerArg): Promise<boolean> =>
    answeredData(
        await mutateRestoreWorkspace({ headers: { [GraphQLHeadersKey.XWorkspaceId]: arg.workspaceId } }),
        MUTATE_RESTORE_WORKSPACE_SWR_KEY,
    ).restoreWorkspace

/** SWR mutation that restores, from the lobby, a workspace its owner deleted. */
export const useMutateRestoreWorkspaceSwr = (): SWRMutationResponse<
    boolean,
    Error,
    typeof MUTATE_RESTORE_WORKSPACE_SWR_KEY,
    TriggerArg["arg"]
> => useSWRMutation(MUTATE_RESTORE_WORKSPACE_SWR_KEY, restore)
