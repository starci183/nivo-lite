"use client"

import { AgentSetupPendingNotice } from "@/components/blocks/AgentSetupPendingNotice"
import { useSearchParams } from "next/navigation"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import type { PageFrameTabs } from "@nivo-lite/agent-sdk/client"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    OWNER_SETUP_NOTICE,
    useConnectionNeedsCopy,
    useInstanceHeader,
    useInstanceRail,
    useInstanceTabs,
    type ModuleKey,
} from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENT_ROLES_HREF, workspaceHref } from "@/modules/routes"
import { useAgentWorkView } from "@/hooks/agentWork"
import { navigation } from "@/modules/i18n"
import { AgentInstanceFrameBase, type InstanceHeaderView, type InstanceSwitch } from "./component"
import { RUN_PATH, agentCrumbsOf, instanceViewOf, frameSubTabsOf, rootCrumbsOf, instanceTabOf, versionCrumbOf } from "./parts"

const PLACEHOLDER: InstanceHeaderView = {
    name: "-",
    module: "chatbot",
    isEarly: false,
    statusLabel: "-",
    statusTone: "neutral",
    subtitle: "-",
    needs: { lines: [], linkLabel: "-", href: "#" },
    primary: null,
    profileHref: null,
    packageHref: null,
}

/** What the layout hands the frame: the type and the instance of the url, and the routed tab. */
interface AgentInstanceFrameProps {
    readonly module: ModuleKey
    readonly installationId: string
    /** The routed tab drawn inside the frame. */
    readonly content: ReactNode
}

/** The tabs whose body is panes, attached flush under the tab line; the other tabs are card bodies. */
const PANES_TABS: ReadonlySet<string> = new Set(["setup", "work", "workbench", "graph", "workflows", "chat"])

/** The agents the header's menu can open: every installed agent, the open one checked, and the way to add one for a person who may. */
const switcherOf = (
    t: ReturnType<typeof useTranslations<"modulesCore">>,
    items: ReturnType<typeof useInstanceRail>["items"],
    canAdd: boolean,
    currentId: string,
    workspaceId: string,
): InstanceSwitch => ({
    label: t("switchAgent"),
    currentId,
    add: canAdd ? { label: t("railAdd"), href: workspaceHref(workspaceId, AGENT_ROLES_HREF) } : null,
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
    const tw = useTranslations("agentWork")
    const tr = useTranslations("agentRuns")
    const twf = useTranslations("agentWorkflows")
    const twp = useTranslations("agentWorkflowPages")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const work = useAgentWorkView()
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
    const workspaceId = useWorkspaceId()
    const [viewTabs, setViewTabs] = useState<PageFrameTabs | null>(null)
    const runId = RUN_PATH.exec(pathname)?.[1] ?? null
    const subTabs = frameSubTabsOf({
        selected,
        pathname,
        runId,
        work,
        viewTabs,
        words: { work: tw, setup: twf, workflow: twp },
        setupHref: hrefOf("setup"),
        push: router.push,
    })
    return (
        <AgentInstanceFrameBase
            content={props.content}
            props={{
                hasPanes: PANES_TABS.has(selected),
                ariaLabel: header.name === "" ? header.typeName : header.name,
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    ...rootCrumbsOf({ shell: ts, modules: t, workspaceId }),
                    ...agentCrumbsOf({
                        header,
                        isLoading,
                        runId,
                        workspaceId,
                        module: props.module,
                        installationId: props.installationId,
                        workLabel: t("tab_work"),
                        workHref: hrefOf("work"),
                        runLabel: runId === null ? "" : tr("crumbRun", { id: runId.slice(0, 6) }),
                        version: versionCrumbOf(pathname, twp),
                    }),
                ],
                tabsLabel: t("tabsLabel"),
                selectedTab: selected,
                subTabs,
                tabs: tabs.map((tab) => instanceTabOf(tab, t(`tab_${tab}`), hrefOf(tab), header.counts)),
                earlyLabel: t("earlyBadge"),
                profileLabel: t("profileShort"),
                packageLabel: tt("packageTitle"),
                notice: query.get("notice") === OWNER_SETUP_NOTICE ? t("ownerSetupNotice") : "",
                // The Setup tab is where the notice leads: there it would point at itself.
                setupNotice:
                    selected === "setup" ? null : (
                        <AgentSetupPendingNotice
                            module={props.module}
                            installationId={props.installationId}
                            setupHref={hrefOf("setup")}
                        />
                    ),
                moreLabel: pane.moreActions,
                isLoading,
                read: mapSlot(header.slot, () => true),
                labels: labels(t("catalogTitle")),
                switcher: switcherOf(t, rail.items, isManager(member), props.installationId, workspaceId),
                view: instanceViewOf({
                    resolved,
                    placeholder: { ...PLACEHOLDER, name: header.typeName },
                    t,
                    needs,
                    module: props.module,
                    installationId: props.installationId,
                    workspaceId,
                    canPackage: isManager(member),
                }),
            }}
            on={{ retry: header.retry, viewTabs: setViewTabs }}
        />
    )
}
