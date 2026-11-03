import { useQueryLeadWaitSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"

import type { SWRResponse } from "swr"

type UseLeadWaitResult = SWRResponse<
    {
        show: boolean
        hours: number | null
        replied: boolean
    },
    unknown
>

/** How long a website lead waited for its first reply, when the back end says the note is worth showing. */
export const useLeadWait = (leadId: string): UseLeadWaitResult => {
    const { activeWorkspaceId } = useActiveWorkspace()
    return useQueryLeadWaitSwr(activeWorkspaceId, leadId)
}
