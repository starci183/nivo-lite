"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAgentRecordRoute } from "@/hooks/installations"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { AgentRecordRedirectBase } from "./component"

const PLACEHOLDER: ReadonlyArray<{ readonly id: string; readonly text: string }> = [
    { id: "first", text: "-" },
    { id: "second", text: "-" },
]

/** What the old agent url hands the block. */
interface AgentRecordRedirectProps {
    readonly agentId: string
}

/** Sends an old agent url to the instance its agent drives (agents and installations are read in the browser). */
export const AgentRecordRedirect = (props: AgentRecordRedirectProps) => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    const { isUnknown } = useAgentRecordRoute(props.agentId)
    if (isUnknown) notFound()
    return (
        <AgentRecordRedirectBase
            props={{
                label: t("catalogTitle"),
                slot: loadingSlot(),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("catalogTitle")),
            }}
        />
    )
}
