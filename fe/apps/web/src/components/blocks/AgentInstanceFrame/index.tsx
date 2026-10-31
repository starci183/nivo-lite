"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useConnectionNeedsCopy, useInstanceHeader, useInstanceRail, useInstanceTabs } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AGENT_ROLES_HREF, AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"
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
    readonly children?: ReactNode
}

/** The tabs whose body is panes, attached flush under the tab line; the other tabs are card bodies. */
const PANES_TABS: ReadonlySet<string> = new Set(["setup", "work"])

/** The connected frame of an agent instance: the page band (trail, person, facts, agent switcher, actions, instance link tabs) and the routed tab. */
export const AgentInstanceFrame = (props: AgentInstanceFrameProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const { tabs, selected, hrefOf } = useInstanceTabs(props.module, props.installationId)
    const header = useInstanceHeader(props.module, props.installationId)
    const needs = useConnectionNeedsCopy()
    const rail = useInstanceRail(props.installationId)
    return (
        <AgentInstanceFrameBase
            shape={{ body: props.children }}
            props={{
                hasPanes: PANES_TABS.has(selected),
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
                switcher: {
                    label: t("switchAgent"),
                    currentId: props.installationId,
                    addLabel: t("railAdd"),
                    addHref: AGENT_ROLES_HREF,
                    items: rail.items.map((item) => ({
                        id: item.id,
                        name: item.name,
                        seed: item.seed,
                        avatarUrl: item.avatarUrl,
                        description: [item.roleName, t(`lifecycle_${item.lifecycle}`)].join(" · "),
                        href: item.href,
                    })),
                },
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
