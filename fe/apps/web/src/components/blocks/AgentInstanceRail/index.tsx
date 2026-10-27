"use client"

import { useTranslations } from "next-intl"
import { useInstanceRail } from "@/hooks/installations"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE } from "@/modules/routes"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { AgentInstanceRailBase } from "./component"
import type { AgentInstanceRailItem } from "./component"

const PLACEHOLDER: ReadonlyArray<AgentInstanceRailItem> = [
    {
        id: "-",
        name: "-",
        seed: "-",
        avatarUrl: null,
        roleName: "-",
        isCurrent: false,
        statusLabel: "-",
        statusTone: "neutral",
    },
]

/** What the layout hands the rail: the instance of the url, which is the current one. */
interface AgentInstanceRailProps {
    readonly installationId: string
}

/** The connected switcher of the installed agents: they are read in the browser; a row opens that agent. */
export const AgentInstanceRail = (props: AgentInstanceRailProps) => {
    const t = useTranslations("modulesCore")
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const rail = useInstanceRail(props.installationId)
    return (
        <AgentInstanceRailBase
            props={{
                navLabel: t("navLabel"),
                title: t("railTitle"),
                addLabel: t("railAdd"),
                addHref: AGENTS_ROUTE,
                slot: rail.isLoading
                    ? loadingSlot()
                    : {
                          items: rail.items.map((item) => ({
                              id: item.id,
                              name: item.name,
                              seed: item.seed,
                              avatarUrl: item.avatarUrl,
                              roleName: item.roleName,
                              isCurrent: item.isCurrent,
                              statusLabel: t(`lifecycle_${item.lifecycle}`),
                              statusTone: item.statusTone,
                          })),
                      },
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("yoursEmptyTitle")),
            }}
            on={{
                open: (id) => {
                    const target = rail.items.find((item) => item.id === id)
                    if (target !== undefined) router.push(target.href)
                },
            }}
        />
    )
}
