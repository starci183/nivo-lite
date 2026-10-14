"use client"

import useSWRMutation from "swr/mutation"
import { mutateCreateWorkspace } from "@/modules/api/graphql/mutations/mutation-create-workspace"
import type { MutateCreateWorkspaceRequest } from "@/modules/api/graphql/mutations/mutation-create-workspace"

/** What the create workspace mutation is triggered with. */
interface CreateWorkspaceArg {
    readonly arg: MutateCreateWorkspaceRequest
}

/** The SWR key of the create workspace mutation. */
export const MUTATE_CREATE_WORKSPACE_SWR_KEY = "MUTATE_CREATE_WORKSPACE_SWR"

/** SWR mutation for {@link mutateCreateWorkspace}: `trigger({ name })` answers the new workspace id and rejects with the back end failure. */
export const useMutateCreateWorkspaceSwr = () =>
    useSWRMutation(MUTATE_CREATE_WORKSPACE_SWR_KEY, async (_key: string, { arg }: CreateWorkspaceArg) => {
        const result = await mutateCreateWorkspace({ request: arg })
        if (!result.data) throw new Error("createWorkspace answered no data")
        return result.data.createWorkspace
    })
