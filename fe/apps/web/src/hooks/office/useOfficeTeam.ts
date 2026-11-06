import { useWorkspaceId } from "@/hooks/workspaces"
import {
    useQueryLeadDirectorySwr,
    useQueryModuleInstallationsSwr,
    useQueryResponsibilitiesSwr,
    useQueryWorkspaceMembersSwr,
    useQueryWorkspaceStaffSwr,
} from "@/hooks/swr"
import { toOfficeAgents, toOfficeLead, toOfficePeople, toOfficeTask } from "@/modules/office"

type InstallationsRead = ReturnType<typeof useQueryModuleInstallationsSwr>
type StaffRead = ReturnType<typeof useQueryWorkspaceStaffSwr>

/** What the team around the thread gives: its reads, their projections, and the first failure. */
type UseOfficeTeamResult = {
    teamReads: Array<
        | InstallationsRead
        | ReturnType<typeof useQueryWorkspaceMembersSwr>
        | StaffRead
        | ReturnType<typeof useQueryLeadDirectorySwr>
        | ReturnType<typeof useQueryResponsibilitiesSwr>
    >
    composerReads: Array<InstallationsRead | StaffRead>
    reloadTeam: () => void
    agents: ReturnType<typeof toOfficeAgents>
    people: ReturnType<typeof toOfficePeople>
    staff: NonNullable<StaffRead["data"]>
    leads: Array<ReturnType<typeof toOfficeLead>>
    tasks: Array<ReturnType<typeof toOfficeTask>>
    isLoading: boolean
    error: unknown
}

/** The team around the thread, with the first-load status and failure of every read kept beside its projection. */
export const useOfficeTeam = (): UseOfficeTeamResult => {
    const workspaceId = useWorkspaceId()
    const installations = useQueryModuleInstallationsSwr()
    const members = useQueryWorkspaceMembersSwr(workspaceId)
    const staff = useQueryWorkspaceStaffSwr(workspaceId)
    const leads = useQueryLeadDirectorySwr(workspaceId)
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
            installations.isLoading || members.isLoading || staff.isLoading || leads.isLoading || tasks.isLoading,
        error,
    }
}
