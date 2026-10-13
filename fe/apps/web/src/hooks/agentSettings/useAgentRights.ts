import { isManager, useMember } from "@/hooks/member"

/** What the signed-in person may do on the settings of an agent: owners and managers edit it, only the owner grants connections. */
export const useAgentRights = (): { readonly canEdit: boolean; readonly canGrant: boolean } => {
    const member = useMember()
    return { canEdit: isManager(member), canGrant: member === null || member.role === "owner" }
}
