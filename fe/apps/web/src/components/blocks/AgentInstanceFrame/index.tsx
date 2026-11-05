"use client"

import { useSearchParams } from "next/navigation"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    OWNER_SETUP_NOTICE,
    useConnectionNeedsCopy,
    useInstanceHeader,
    useInstanceRail,
    useInstanceTabs,
    isSetupPending,
    setupLabelKey,
} from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { useWorkbenchWhyKey } from "@/hooks/workbench"
import { AGENT_ROLES_HREF, AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"
import { AgentInstanceFrameBase } from "./component"
import type { InstanceHeaderView, InstanceSwitch } from "./component"

const PLACEHOLDER: InstanceHeaderView = {
    name: "-",
    seed: "-",
    avatarUrl: null,
    isEarly: false,
    statusLabel: "-",
    statusTone: "neutral",
    subtitle: "-",
    needs: { lines: [], linkLabel: "-", href: "#" },
    setup: null,
    chatHref: null,
    profileHref: null,
    packageHref: null,
}

/** What the layout hands the frame: the type and the instance of the url, and the routed tab. */
interface AgentInstanceFrameProps {
    readonly module: ModuleKey
    readonly installationId: string
    readonly children: ReactNode
}

/** The tabs whose body is panes, attached flush under the tab line; the other tabs are card bodies. */
const PANES_TABS: ReadonlySet<string> = new Set(["setup", "work", "inbox"])

/** The agents the header's menu can open: every installed agent, the open one checked, and the way to add one for a person who may. */
const switcherOf = (
    t: ReturnType<typeof useTranslations<"modulesCore">>,
    items: ReturnType<typeof useInstanceRail>["items"],
    canAdd: boolean,
    currentId: string,
): InstanceSwitch => ({
    label: t("switchAgent"),
    currentId,
    add: canAdd ? { label: t("railAdd"), href: AGENT_ROLES_HREF } : null,
    items: items.map((item) => ({
        id: item.id,
        name: item.name,
        seed: item.seed,
        avatarUrl: item.avatarUrl,
        description: [item.roleName, t(`lifecycle_${item.lifecycle}`)].join(" · "),
        href: item.href,
    })),
})

/** The connected frame of an agent instance: the page band (trail, person, facts, agent switcher, actions, instance link tabs) and the routed tab. */
export const AgentInstanceFrame = (props: AgentInstanceFrameProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const tt = useTranslations("agentTemplates")
    const pane = usePaneCopy()
    const query = useSearchParams()
    const { tabs, selected, hrefOf } = useInstanceTabs(props.module, props.installationId)
    const header = useInstanceHeader(props.module, props.installationId)
    const labels = useSlotLabels()
    const resolved = "items" in header.slot ? header.slot.items : undefined
    const isLoading = "isLoading" in header.slot
    const needs = useConnectionNeedsCopy()
    const rail = useInstanceRail(props.installationId)
    const member = useMember()
    const why = useWorkbenchWhyKey()
    return (
        <AgentInstanceFrameBase
            children={props.children}
            props={{
                hasPanes: PANES_TABS.has(selected) || (selected === "workbench" && why.workItemId !== null),
                ariaLabel: header.name === "" ? header.typeName : header.name,
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
                    isLoading
                        ? { id: "agent", label: "", isLoading: true }
                        : { id: "agent", label: header.name === "" ? header.typeName : header.name },
                ],
                tabsLabel: t("tabsLabel"),
                selectedTab: selected,
                tabs: tabs.map((tab) => ({
                    id: tab,
                    label: t(`tab_${tab}`),
                    href: hrefOf(tab),
                })),
                earlyLabel: t("earlyBadge"),
                chatLabel: t("privateChat"),
                profileLabel: t("profileShort"),
                packageLabel: tt("packageTitle"),
                notice: query.get("notice") === OWNER_SETUP_NOTICE ? t("ownerSetupNotice") : "",
                moreLabel: pane.moreActions,
                isLoading,
                read: mapSlot(header.slot, () => true),
                labels: labels(t("catalogTitle")),
                switcher: switcherOf(t, rail.items, isManager(member), props.installationId),
                view:
                    resolved === undefined
                        ? { ...PLACEHOLDER, name: header.typeName }
                        : {
                              name: resolved.name,
                              seed: resolved.seed,
                              avatarUrl: resolved.avatarUrl,
                              isEarly: resolved.isEarly,
                              statusLabel: t(`lifecycle_${resolved.lifecycle}`),
                              statusTone: resolved.statusTone,
                              subtitle: resolved.subtitle,
                              needs: {
                                  lines: needs.linesOf(resolved.connectionNeeds),
                                  linkLabel: needs.linkLabel,
                                  href: needs.href,
                              },
                              setup:
                                  isSetupPending(resolved.lifecycle) && selected !== "setup" && tabs.includes("setup")
                                      ? { label: t(setupLabelKey(resolved.lifecycle)), href: hrefOf("setup") }
                                      : null,
                              chatHref: resolved.chatHref,
                              profileHref: resolved.profileHref,
                              packageHref: isManager(member)
                                  ? `${AGENTS_ROUTE}/templates/package/${props.installationId}`
                                  : null,
                          },
            }}
            on={{ retry: header.retry }}
        />
    )
}
