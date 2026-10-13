import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { isManagerRole } from "@/lib/members-shared"
import { listInstallations } from "@/lib/modules-core"
import { getSession } from "@/lib/session"
import { MODULE_CATEGORIES, MODULE_KEYS, MODULE_REGISTRY, pickCopy, pickCopyList } from "@/modules/catalog"
import type { CopyLocale } from "@/modules/catalog"
import { agentHref, foldText, agentStatusOf, AGENT_STATUS_TONE } from "@/modules/installations"
import type { Installation } from "@/modules/installations"
import { APP_ROUTES } from "@/modules/routes"
import { AgentsCatalogPageBase } from "./component"

/** What the route hands the page. */
type AgentsCatalogPageProps = {
    /** The same page while the installations load: the cards of the catalogue are real, each status and action a skeleton. */
    readonly isLoading?: boolean
}

/** The document title of the catalogue page. */
export const agentsCatalogMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** /agents: every agent of the catalogue as a card, grouped by category; installed ones open, the others are one click from set up. */
export const AgentsCatalogPage = async (props: AgentsCatalogPageProps) => {
    const isLoading = props.isLoading === true
    const [t, ts, localeText] = await Promise.all([
        getTranslations("modulesCore"),
        getTranslations("shell"),
        getLocale(),
    ])
    const locale: CopyLocale = localeText === "en" ? "en" : "vi"
    const [installations, session] = isLoading ? [[], null] : await Promise.all([listInstallations(), getSession()])
    const installedOf = (key: string): Installation | undefined => installations.find((i) => i.moduleKey === key)
    const items = MODULE_KEYS.map((key) => {
        const def = MODULE_REGISTRY[key]
        const installation = installedOf(key)
        const status = agentStatusOf(installation)
        const category = MODULE_CATEGORIES.find((c) => c.key === def.category)
        return {
            key,
            categoryKey: def.category,
            installed: installation !== undefined,
            isEarly: def.status === "early",
            searchText: foldText(
                [
                    def.name.vi,
                    def.name.en,
                    def.shortName.vi,
                    def.shortName.en,
                    def.description.vi,
                    def.description.en,
                    ...def.points.vi,
                    ...def.points.en,
                    category?.label.vi ?? "",
                    category?.label.en ?? "",
                ].join(" "),
            ),
            card: {
                name: pickCopy(def.name, locale),
                description: pickCopy(def.description, locale),
                points: pickCopyList(def.points, locale),
                mascot: def.mascot,
                isEarly: def.status === "early",
                earlyLabel: t("earlyBadge"),
                earlyHint: t("earlyHint"),
                statusLabel: t(`status_${status}`),
                statusTone: AGENT_STATUS_TONE[status],
                isLoading,
                openHref: installation === undefined ? null : agentHref(key, null),
                openLabel: t("openModule"),
                canInstall: session !== null && isManagerRole(session.member.role),
                installLabel: t("install"),
            },
        }
    })
    return (
        <AgentsCatalogPageBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle") },
                ],
                eyebrow: t("eyebrow"),
                title: t("catalogTitle"),
                description: t("catalogDescription"),
                catalog: {
                    items,
                    categories: MODULE_CATEGORIES.map((c) => ({ key: c.key, label: pickCopy(c.label, locale) })),
                    isLoading,
                },
            }}
        />
    )
}
