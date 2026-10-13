import { useActiveWorkspace } from "@/hooks/workspaces"
import { useQueryWorkspaceMembersSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceMembersSwr"
import { useQueryWorkspaceStaffSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceStaffSwr"
import { isManager, useMember } from "@/hooks/member"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"

/** One staff row of the workspace. */
export interface StaffRow {
    readonly id: string
    readonly name: string
    readonly role: string
    /** True when this person already signs in (the invite link is only for the others). */
    readonly hasAccount: boolean
}

/** The staff of the active workspace; who already has an account is read for owner and manager only (the invite link needs it). */
export const useAuthorityStaff = (): {
    readonly slot: DataSlot<ReadonlyArray<StaffRow>>
    readonly canInvite: boolean
    readonly reload: () => void
} => {
    const canInvite = isManager(useMember())
    const { activeWorkspaceId } = useActiveWorkspace()
    const staff = useQueryWorkspaceStaffSwr(activeWorkspaceId)
    const members = useQueryWorkspaceMembersSwr(canInvite ? activeWorkspaceId : undefined)
    const linked = new Set(members.data?.map((member) => member.staffId))
    const rows: ReadonlyArray<StaffRow> | undefined = staff.data?.map((one) => ({
        id: one.id,
        name: one.name,
        role: one.role,
        hasAccount: linked.has(one.id),
    }))
    const reload = () => void staff.mutate()
    return { slot: slotOfSwr({ data: rows, error: staff.error, isLoading: staff.isLoading }), canInvite, reload }
}
