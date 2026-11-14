"use client"

import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentWorkSwitch } from "@/hooks/agentWork"
import { useAgentInstallation, useAgentRights, useChooseLive } from "@/hooks/agentSettings"
import { AgentActivityCardBase, type ActivityRowView } from "./component"

/** The installation whose switches the card holds. */
type AgentActivityCardProps = {
    readonly installationId?: string | undefined
    readonly module?: string | undefined
    /** The type answers customers: the live row shows. */
    readonly answersCustomers?: boolean | undefined
}

/** The connected activity card: the work switch and (for a type that talks to customers) the live switch, each acting at once. */
export const AgentActivityCard = (props: AgentActivityCardProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("modulesCore")
    const tw = useTranslations("agentWork")
    const tg = useTranslations("agentGeneral")
    const { canEdit } = useAgentRights()
    const work = useAgentWorkSwitch(route.installationId)
    const { slot } = useAgentInstallation(route.installationId, route.module)
    const agent = "items" in slot ? slot.items : undefined
    const [chosen, setChosen] = useState<boolean | null>(null)
    const { choose, isSaving } = useChooseLive(route.installationId)
    const workView = "items" in work.slot ? work.slot.items : undefined
    const isLive = chosen ?? agent?.isLive ?? false
    const pending = agent?.isSetupPending === true
    const rows: Array<ActivityRowView> = [
        {
            id: "work",
            title: tg("rowWork"),
            subtitle: tw("switchHelp"),
            isSelected: workView?.isOn ?? true,
            isDisabled: !canEdit || work.isChanging || workView?.canChange !== true,
            blocker: workView?.canChange === false ? tw("switchOwnerOnly") : "",
        },
    ]
    if (props.answersCustomers ?? route.answersCustomers) {
        rows.push({
            id: "live",
            title: tg("rowLive"),
            subtitle: t("liveHelp"),
            isSelected: isLive,
            isDisabled: !canEdit || isSaving || (agent?.hasVersion !== true && !isLive),
            blocker: pending ? t("liveNeedsVersion") : "",
        })
    }
    return (
        <AgentActivityCardBase
            props={{ rows }}
            on={{
                change: (id, on) => {
                    if (id === "work") void work.change(on)
                    else {
                        setChosen(on)
                        void choose(on).then(() => setChosen(null))
                    }
                },
            }}
        />
    )
}
