"use client"

import { useTranslations } from "next-intl"
import { useWorkbenchHref } from "@/hooks/installations"
import { AgentLoyaltyExtrasBase } from "./component"

/** The instance of the url. */
interface AgentLoyaltyExtrasProps {
    readonly installationId: string
    readonly module: string
}

/** The connected extra card of a loyalty agent: points to its program on the workbench. */
export const AgentLoyaltyExtras = (props: AgentLoyaltyExtrasProps) => {
    const t = useTranslations("modulesCore")
    const href = useWorkbenchHref(props.module, props.installationId)
    if (href === null) return null
    return (
        <AgentLoyaltyExtrasBase
            props={{
                title: t("loyaltyProgramTitle"),
                description: t("loyaltyProgramText"),
                openLabel: t("loyaltyProgramOpen"),
                openHref: href,
            }}
        />
    )
}
