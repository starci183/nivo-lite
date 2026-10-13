import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { isManagerRole } from "@/lib/members-shared"
import { getInstallationById, listInstallations } from "@/lib/modules-core"
import { getSession } from "@/lib/session"
import { MODULE_KEYS, MODULE_REGISTRY, isModuleKey, pickCopy } from "@/modules/catalog"
import { AGENTS_ROUTE, AGENT_STATUS_TONE, agentHref, agentListHref, agentStatusOf } from "@/modules/installations"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { AgentInstanceLayoutBase } from "./component"

/** What the route hands the layout: the type and the instance of the url and the routed tab; without them the frame is the loading one. */
type AgentInstanceLayoutProps = {
    readonly module?: string
    readonly installationId?: string
    readonly children?: ReactNode
}

const TABS = ["setup", "workbench", "settings"] as const

/** The frame of an agent while it loads: its siblings and tab labels are real, the name, statuses, version and live state are skeletons. */
const loadingFrame = async () => {
    const [t, ts, localeText] = await Promise.all([
        getTranslations("modulesCore"),
        getTranslations("shell"),
        getLocale(),
    ])
    const locale = localeText === "en" ? "en" : "vi"
    const first = MODULE_REGISTRY[MODULE_KEYS[0]]
    return {
        navLabel: t("navLabel"),
        allAgentsLabel: t("allModules"),
        allAgentsHref: AGENTS_ROUTE,
        rail: MODULE_KEYS.map((key) => ({
            id: key,
            href: agentHref(key, null),
            name: pickCopy(MODULE_REGISTRY[key].name, locale),
            mascot: MODULE_REGISTRY[key].mascot,
            isCurrent: false,
            statusLabel: t("status_notInstalled"),
            statusTone: AGENT_STATUS_TONE.notInstalled,
        })),
        crumbLabel: ts("crumbLabel"),
        crumbs: [
            { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
            { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
        ],
        mascot: first.mascot,
        title: pickCopy(first.name, locale),
        isEarly: false,
        earlyLabel: t("earlyBadge"),
        statusLabel: t("status_notInstalled"),
        statusTone: AGENT_STATUS_TONE.notInstalled,
        typeLine: null,
        versionLabel: t("noVersion"),
        liveLabel: t("liveOff"),
        tabsLabel: t("tabsLabel"),
        tabs: TABS.map((tab) => ({ id: tab, label: t(`tab_${tab}`), href: agentHref(first.key, null, tab) })),
        isLoading: true,
    }
}

/**
 * The frame of every agent instance page: the installed agents on the left (one row per instance), the header of the instance and its
 * Setup, Workbench and Settings tabs. A multi-instance type shows the instance name as the heading and the type in the trail.
 */
export const AgentInstanceLayout = async (props: AgentInstanceLayoutProps) => {
    if (props.module === undefined || props.installationId === undefined) {
        return <AgentInstanceLayoutBase props={await loadingFrame()}>{props.children}</AgentInstanceLayoutBase>
    }
    if (!isModuleKey(props.module)) notFound()
    const moduleKey = props.module
    const [session, installation, installations, t, ts, localeText] = await Promise.all([
        getSession(),
        getInstallationById(props.installationId),
        listInstallations(),
        getTranslations("modulesCore"),
        getTranslations("shell"),
        getLocale(),
    ])
    const locale = localeText === "en" ? "en" : "vi"
    if (!installation) return navigation.redirect({ href: agentHref(moduleKey, null), locale })
    if (installation.moduleKey !== moduleKey) {
        return navigation.redirect({ href: agentHref(installation.moduleKey, installation.id), locale })
    }
    const def = MODULE_REGISTRY[moduleKey]
    const typeName = pickCopy(def.name, locale)
    const canSetup = isManagerRole(session.member.role)
    const status = agentStatusOf(installation)
    return (
        <AgentInstanceLayoutBase
            props={{
                navLabel: t("navLabel"),
                allAgentsLabel: t("allModules"),
                allAgentsHref: AGENTS_ROUTE,
                rail: installations.map((other) => ({
                    id: other.id,
                    href: agentHref(other.moduleKey, other.id),
                    name: other.isMulti ? other.name : pickCopy(MODULE_REGISTRY[other.moduleKey].name, locale),
                    mascot: MODULE_REGISTRY[other.moduleKey].mascot,
                    isCurrent: other.id === installation.id,
                    statusLabel: t(`status_${agentStatusOf(other)}`),
                    statusTone: AGENT_STATUS_TONE[agentStatusOf(other)],
                })),
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
                    installation.isMulti
                        ? { id: "module", label: typeName, href: agentListHref(moduleKey) }
                        : { id: "module", label: typeName },
                ],
                mascot: def.mascot,
                title: installation.isMulti ? installation.name : typeName,
                isEarly: def.status === "early",
                earlyLabel: t("earlyBadge"),
                statusLabel: t(`status_${status}`),
                statusTone: AGENT_STATUS_TONE[status],
                typeLine: installation.isMulti ? typeName : null,
                versionLabel:
                    installation.activeVersion === null
                        ? t("noVersion")
                        : t("versionInUse", { version: installation.activeVersion }),
                liveLabel: installation.liveEnabled ? t("liveOn") : t("liveOff"),
                tabsLabel: t("tabsLabel"),
                tabs: TABS.filter((tab) => canSetup || tab !== "setup").map((tab) => ({
                    id: tab,
                    label: t(`tab_${tab}`),
                    href: agentHref(moduleKey, installation.id, tab),
                })),
                isLoading: false,
            }}
        >
            {props.children}
        </AgentInstanceLayoutBase>
    )
}
