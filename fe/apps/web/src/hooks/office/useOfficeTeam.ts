import { useActiveWorkspace } from "@/hooks/workspaces"
import {
    useQueryLeadDirectorySwr,
    useQueryModuleInstallationsSwr,
    useQueryResponsibilitiesSwr,
    useQueryWorkspaceMembersSwr,
    useQueryWorkspaceStaffSwr,
} from "@/hooks/swr"
import { toOfficeAgents, toOfficeLead, toOfficePeople, toOfficeTask } from "@/modules/office"

/** The team around the thread: agents, accounts, staff, customers and tasks. A failed read reads as empty. */
export const useOfficeTeam = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const installations = useQueryModuleInstallationsSwr()
    const members = useQueryWorkspaceMembersSwr(activeWorkspaceId)
    const staff = useQueryWorkspaceStaffSwr(activeWorkspaceId)
    const leads = useQueryLeadDirectorySwr(activeWorkspaceId)
    const tasks = useQueryResponsibilitiesSwr()
    return {
        agents: toOfficeAgents(installations.data ?? []),
        people: toOfficePeople(members.data ?? []),
        staff: staff.data ?? [],
        leads: leads.data?.map(toOfficeLead) ?? [],
        tasks: tasks.data?.map(toOfficeTask) ?? [],
    }
}
