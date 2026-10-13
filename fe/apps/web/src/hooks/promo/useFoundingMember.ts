import { useQueryFoundingMemberSwr } from "@/hooks/swr/api/graphql/queries/useQueryFoundingMemberSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** Whether the selected workspace's purchase qualifies for the founding welcome; idle unless `enabled`. */
export const useFoundingMember = (enabled: boolean) => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryFoundingMemberSwr(enabled ? activeWorkspaceId : undefined)
}
