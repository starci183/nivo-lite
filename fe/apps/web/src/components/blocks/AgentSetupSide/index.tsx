"use client"

import { useAgentRights } from "@/hooks/agentSettings"
import { useSetupSide } from "@/hooks/setupSide"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { AgentSetupSideBase } from "./component"

/** What the Setup page hands the side column: the type and the instance of the url. */
type AgentSetupSideProps = {
    readonly module: string
    readonly installationId: string
}

/** The connected side column of the Setup tab: the draft, the checklist, the knowledge and the versions of one agent. */
export const AgentSetupSide = (props: AgentSetupSideProps) => {
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const side = useSetupSide(props.module, props.installationId)
    if (!canEdit) return null
    return (
        <AgentSetupSideBase
            props={{ slot: side.slot, placeholder: side.placeholder, slotLabels: slotLabels("") }}
            on={{ ...side.on, open: (href) => router.push(href), retry: side.reload }}
        />
    )
}
