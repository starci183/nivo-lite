"use client"

import { useTranslations } from "next-intl"
import { useConnectionNeedsCopy, useInstanceHeader } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AgentInstanceHeaderBase } from "./component"

/** What the layout hands the header: the type and the instance of the url. */
interface AgentInstanceHeaderProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The connected header of an agent instance: the person (avatar, name, status), "@handle - role - channels" and the chat and profile actions. */
export const AgentInstanceHeader = (props: AgentInstanceHeaderProps) => {
    const t = useTranslations("modulesCore")
    const header = useInstanceHeader(props.module, props.installationId)
    const needs = useConnectionNeedsCopy()
    return (
        <AgentInstanceHeaderBase
            props={{
                name: header.name,
                seed: header.seed,
                avatarUrl: header.avatarUrl,
                isEarly: header.isEarly,
                earlyLabel: t("earlyBadge"),
                statusLabel: t(`lifecycle_${header.lifecycle}`),
                statusTone: header.statusTone,
                subtitle: header.subtitle,
                needs: { lines: needs.linesOf(header.connectionNeeds), linkLabel: needs.linkLabel, href: needs.href },
                chatHref: header.chatHref,
                chatLabel: t("privateChat"),
                profileHref: header.profileHref,
                profileLabel: t("profileShort"),
                isLoading: header.isLoading,
            }}
        />
    )
}
