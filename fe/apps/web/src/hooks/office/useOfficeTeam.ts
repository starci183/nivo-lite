import { useActiveWorkspace } from "@/hooks/workspaces"
import {
    useQueryLeadDirectorySwr,
    useQueryModuleInstallationsSwr,
    useQueryResponsibilitiesSwr,
    useQueryWorkspaceMembersSwr,
    useQueryWorkspaceStaffSwr,
} from "@/hooks/swr"
import { toOfficeAgents, toOfficeLead, toOfficePeople, toOfficeTask } from "@/modules/office"

/** The team around the thread, with the first-load status and failure of every read kept beside its projection. */
export const useOfficeTeam = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const installations = useQueryModuleInstallationsSwr()
    const members = useQueryWorkspaceMembersSwr(activeWorkspaceId)
    const staff = useQueryWorkspaceStaffSwr(activeWorkspaceId)
    const leads = useQueryLeadDirectorySwr(activeWorkspaceId)
    const tasks = useQueryResponsibilitiesSwr()
    const error: unknown = installations.error ?? members.error ?? staff.error ?? leads.error ?? tasks.error
    return {
        teamReads: [installations, members, staff, leads, tasks],
        composerReads: [installations, staff],
        reloadTeam: () => {
            void installations.mutate()
            void members.mutate()
            void staff.mutate()
            void leads.mutate()
            void tasks.mutate()
        },
        agents: toOfficeAgents(installations.data ?? []),
        people: toOfficePeople(members.data ?? []),
        staff: staff.data ?? [],
        leads: leads.data?.map(toOfficeLead) ?? [],
        tasks: tasks.data?.map(toOfficeTask) ?? [],
        isLoading:
            activeWorkspaceId === undefined ||
            installations.isLoading ||
            members.isLoading ||
            staff.isLoading ||
            leads.isLoading ||
            tasks.isLoading,
        error,
    }
}
