import { useQueryLeadGenWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadGenWorkbenchSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** The Lead Gen workbench of the active workspace; `installationId` picks one agent when the workspace runs several. */
export const useLeadGenWorkbench = (installationId: string | null | undefined) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryLeadGenWorkbenchSwr(activeWorkspaceId, { installationId })
    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error,
        retry: () => {
            void query.mutate()
        },
    }
}
