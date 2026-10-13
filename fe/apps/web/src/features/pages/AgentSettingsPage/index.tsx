import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { listConnections } from "@/lib/channels"
import { isDataProvider, purposeFor } from "@/lib/connection-access"
import { MODULE_PROVIDERS } from "@/lib/connections-shared"
import { DEFAULT_REPLY_TIMEOUT_SEC } from "@/lib/engine-queue-shared"
import { isManagerRole } from "@/lib/members-shared"
import { getInstallationById } from "@/lib/modules-core"
import { getSession } from "@/lib/session"
import { MODULE_KEYS, MODULE_REGISTRY, isModuleKey, pickCopy } from "@/modules/catalog"
import { AgentSettingsPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentSettingsPageProps = {
    readonly module: string
    readonly installationId: string
}

const CONNECTIONS_ROUTE = "/connections"
const AUTOMATIONS_ROUTE = "/automations"
const TIMEOUT_MIN = 5

/** The document title of the settings tab. */
export const agentSettingsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_settings") }
}

const numberOf = (value: unknown): number => (typeof value === "number" ? value : Number(value))

/** The settings tab of one instance: display name, operating mode, live switch, the connections its agent uses and the extras of its module. */
export const AgentSettingsPage = async (props: AgentSettingsPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    const moduleKey = props.module
    const [installation, session, t, localeText, automationsT] = await Promise.all([
        getInstallationById(props.installationId),
        getSession(),
        getTranslations("modulesCore"),
        getLocale(),
        getTranslations("automations"),
    ])
    if (!installation || installation.moduleKey !== moduleKey) notFound()
    const locale = localeText === "en" ? "en" : "vi"
    const def = MODULE_REGISTRY[moduleKey]
    // Non-secret facts only: the credentials never leave the server. The connections the agent can use follow the rule of the Connections
    // page picker (purposeFor), narrowed to the providers the module declares plus the data connectors every agent may read.
    const all = (await listConnections(session.workspace.id)).filter(
        (c) =>
            purposeFor(moduleKey, c.provider) !== null &&
            (isDataProvider(c.provider) || MODULE_PROVIDERS[moduleKey].includes(c.provider)),
    )
    const agentId = installation.agentId
    const options = all.filter((c) => c.status !== "disconnected" || (agentId !== null && c.agentIds.includes(agentId)))
    const labelOf = (c: (typeof all)[number]): string => {
        if (c.provider === "telegram" && c.meta.bot_username) return `${c.name} (@${c.meta.bot_username})`
        if ((c.provider === "sepay" || c.provider === "casso") && c.meta.account_masked) {
            return `${c.name} (${c.meta.account_masked ?? ""})`
        }
        return c.name
    }
    const canEdit = isManagerRole(session.member.role)
    const savedTimeout = numberOf(installation.settings.openclawTimeoutSec)
    const bound = options.some(
        (c) =>
            c.status !== "disconnected" &&
            (agentId === null ? null : (c.grants.find((g) => g.agentId === agentId)?.access ?? null)) !== null,
    )
    return (
        <AgentSettingsPageBase
            props={{
                isLoading: false,
                installation,
                module: moduleKey,
                glyph: def.glyph,
                sharedType: installation.isMulti ? pickCopy(def.shortName, locale) : "",
                canEdit,
                canGrant: session.member.role === "owner",
                connections: options.map((c) => ({
                    id: c.id,
                    label: labelOf(c),
                    status: c.status,
                    purpose: purposeFor(moduleKey, c.provider),
                    access: agentId === null ? "" : (c.grants.find((g) => g.agentId === agentId)?.access ?? ""),
                })),
                connectionsHref: CONNECTIONS_ROUTE,
                automationsHref: AUTOMATIONS_ROUTE,
                automationsScope: moduleKey,
                automationsTexts: {
                    title: automationsT("moduleTitle"),
                    seeAll: automationsT("seeAll"),
                    help: automationsT("moduleHelp"),
                },
                extrasKey: def.settingsExtras,
                timeoutSec:
                    Number.isFinite(savedTimeout) && savedTimeout >= TIMEOUT_MIN
                        ? Math.round(savedTimeout)
                        : DEFAULT_REPLY_TIMEOUT_SEC,
                holdingMessage:
                    typeof installation.settings.holdingMessage === "string"
                        ? installation.settings.holdingMessage
                        : "",
                // Shifts speaks to staff only through the Telegram or Zalo connections bound to its agent; with none, shift notices stay in Office.
                shiftsNotice: moduleKey === "shifts" && !bound ? t("shiftsBindChannel") : "",
            }}
        />
    )
}

/** The settings tab while it loads: the same cards, with names and values as skeletons. */
export const AgentSettingsLoadingPage = () => {
    const moduleKey = MODULE_KEYS[0]
    return (
        <AgentSettingsPageBase
            props={{
                isLoading: true,
                installation: null,
                module: moduleKey,
                glyph: MODULE_REGISTRY[moduleKey].glyph,
                sharedType: "",
                canEdit: false,
                canGrant: false,
                connections: [],
                connectionsHref: CONNECTIONS_ROUTE,
                automationsHref: AUTOMATIONS_ROUTE,
                automationsScope: null,
                automationsTexts: { title: "", seeAll: "", help: "" },
                extrasKey: null,
                timeoutSec: DEFAULT_REPLY_TIMEOUT_SEC,
                holdingMessage: "",
                shiftsNotice: "",
            }}
        />
    )
}
