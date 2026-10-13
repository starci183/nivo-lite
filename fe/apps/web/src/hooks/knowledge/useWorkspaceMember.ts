import { useActiveWorkspace } from "@/hooks/workspaces"
import type { ConsoleWorkspace } from "@/modules/types"
import { useQueryMyWorkspacesSwr } from "@/hooks/swr"

const roleOf = (value: string): ConsoleWorkspace["role"] => (value === "owner" || value === "manager" ? value : "staff")

/** What the membership of the active workspace gives a block. */
interface WorkspaceMember {
    /** The workspace the person works in; undefined until the store restores it and `myWorkspaces` answers. */
    readonly workspaceId: string | undefined
    readonly workspaceName: string
    readonly role: ConsoleWorkspace["role"]
    /** Owners and managers write; everyone reads. */
    readonly canWrite: boolean
    readonly isLoading: boolean
    readonly error: unknown
}

/** The membership of the active workspace, from `myWorkspaces`: role, name and whether the member may write. */
export const useWorkspaceMember = (): WorkspaceMember => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const { data, error, isLoading } = useQueryMyWorkspacesSwr()
    const membership = (data ?? []).find(
        (one) => one.workspace.id === activeWorkspaceId && one.member.status === "active",
    )
    const role = roleOf(membership?.member.role ?? "")
    return {
        workspaceId: membership?.workspace.id,
        workspaceName: membership?.workspace.name ?? "",
        role,
        canWrite: role !== "staff",
        isLoading,
        error,
    }
}
