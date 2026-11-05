import { useEffect } from "react"
import { useAgentRights } from "@/hooks/agentSettings"
import { useMember } from "@/hooks/member"
import { navigation } from "@/modules/i18n"
import { OWNER_SETUP_NOTICE, agentHref } from "@/modules/installations"
import type { ModuleKey } from "@/modules/catalog"

/** Staff may not set an agent up: once the session is known, they are sent to the agent's workbench, which says so in a soft notice. */
export const useStaffSetupRedirect = (module: ModuleKey, installationId: string): void => {
    const member = useMember()
    const { canEdit } = useAgentRights()
    const router = navigation.useRouter()
    const isStaff = member !== null && !canEdit
    useEffect(() => {
        if (isStaff) router.replace(agentHref(module, installationId, "workbench", `notice=${OWNER_SETUP_NOTICE}`))
    }, [isStaff, router, module, installationId])
}
