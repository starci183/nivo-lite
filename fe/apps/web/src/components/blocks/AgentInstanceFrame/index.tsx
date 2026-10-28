"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useConnectionNeedsCopy, useInstanceHeader, useInstanceTabs } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"
import { AgentInstanceFrameBase } from "./component"
import type { InstanceHeaderView } from "./component"

const PLACEHOLDER: InstanceHeaderView = {
    name: "-",
    seed: "-",
    avatarUrl: null,
    isEarly: false,
    statusLabel: "-",
    statusTone: "neutral",
    subtitle: "-",
    needs: { lines: [], linkLabel: "-", href: "#" },
    chatHref: null,
    profileHref: null,
}

/** What the layout hands the frame: the type and the instance of the url, and the routed tab. */
interface AgentInstanceFrameProps {
    readonly module: ModuleKey
    readonly installationId: string
    /** The installed agents rail, drawn by the layout. */
    readonly rail: ReactNode
    readonly children?: ReactNode
}

/** The connected frame of an agent instance: the page band (trail, person, facts, actions, instance link tabs), the installed agents rail and the routed tab. */
export const AgentInstanceFrame = (props: AgentInstanceFrameProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const { tabs, hrefOf } = useInstanceTabs(props.module, props.installationId)
    const header = useInstanceHeader(props.module, props.installationId)
    const needs = useConnectionNeedsCopy()
    return (
        <AgentInstanceFrameBase
            shape={{ rail: props.rail, body: props.children }}
            props={{
                ariaLabel: props.installationId,
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
                    header.isLoading
                        ? { id: "agent", label: "", isSkeleton: true }
                        : { id: "agent", label: header.name === "" ? header.typeName : header.name },
                ],
                tabsLabel: t("tabsLabel"),
                tabs: tabs.map((tab) => ({
                    id: tab,
                    label: t(`tab_${tab}`),
                    href: hrefOf(tab),
                })),
                earlyLabel: t("earlyBadge"),
                chatLabel: t("privateChat"),
                profileLabel: t("profileShort"),
                isSkeleton: header.isLoading,
                view: header.isLoading
                    ? PLACEHOLDER
                    : {
                          name: header.name,
                          seed: header.seed,
                          avatarUrl: header.avatarUrl,
                          isEarly: header.isEarly,
                          statusLabel: t(`lifecycle_${header.lifecycle}`),
                          statusTone: header.statusTone,
                          subtitle: header.subtitle,
                          needs: {
                              lines: needs.linesOf(header.connectionNeeds),
                              linkLabel: needs.linkLabel,
                              href: needs.href,
                          },
                          chatHref: header.chatHref,
                          profileHref: header.profileHref,
                      },
            }}
        />
    )
}
