"use client"

import { useTranslations } from "next-intl"
import { useTypeRoute } from "@/hooks/installations"
import type { AgentTab, ModuleKey } from "@/hooks/installations"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { AgentTypeRedirectBase } from "./component"

const PLACEHOLDER: ReadonlyArray<{ readonly id: string; readonly text: string }> = [
    { id: "first", text: "-" },
    { id: "second", text: "-" },
    { id: "third", text: "-" },
]

/** What the old tab url hands the block. */
interface AgentTypeRedirectProps {
    readonly module: ModuleKey
    readonly tab: AgentTab
    readonly query: string
}

/** Sends an old type-level tab url to the only instance, else to the list of instances (the installed agents are read in the browser). */
export const AgentTypeRedirect = (props: AgentTypeRedirectProps) => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    useTypeRoute(props.module, props.tab, props.query, "redirect")
    return (
        <AgentTypeRedirectBase
            props={{
                label: t("catalogTitle"),
                slot: loadingSlot(),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("catalogTitle")),
            }}
        />
    )
}
