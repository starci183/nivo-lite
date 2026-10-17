import { useAppSelector } from "@/redux"

/** Keys a workspace query by its ordered parameters, pausing absent parameters or an empty workspace. */
export const useWorkspaceParamsKey = <Params extends readonly unknown[]>(
    name: string,
    params: Params | null,
): readonly [string, string, ...Params] | null => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    return workspaceId && params ? [name, workspaceId, ...params] : null
}
