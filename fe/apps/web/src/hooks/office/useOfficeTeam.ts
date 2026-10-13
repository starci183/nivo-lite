import { useActiveWorkspace } from "@/hooks/workspaces"
import { useQueryLeadBoardSwr } from "@/hooks/swr/api/graphql/queries/useQueryLeadBoardSwr"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr/api/graphql/queries/useQueryModuleInstallationsSwr"
import { useQueryResponsibilitiesSwr } from "@/hooks/swr/api/graphql/queries/useQueryResponsibilitiesSwr"
import { useQueryWorkspaceMembersSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceMembersSwr"
import { useQueryWorkspaceStaffSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceStaffSwr"
import { toOfficeAgents, toOfficeLead, toOfficePeople, toOfficeTask } from "@/modules/office"

/** The team around the thread: agents, accounts, staff, customers and tasks. A failed read reads as empty. */
export const useOfficeTeam = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const installations = useQueryModuleInstallationsSwr()
    const members = useQueryWorkspaceMembersSwr(activeWorkspaceId)
    const staff = useQueryWorkspaceStaffSwr(activeWorkspaceId)
    const leads = useQueryLeadBoardSwr()
    const tasks = useQueryResponsibilitiesSwr()
    return {
        agents: toOfficeAgents(installations.data ?? []),
        people: toOfficePeople(members.data ?? []),
        staff: staff.data ?? [],
        leads: leads.data?.map(toOfficeLead) ?? [],
        tasks: tasks.data?.map(toOfficeTask) ?? [],
    }
}
