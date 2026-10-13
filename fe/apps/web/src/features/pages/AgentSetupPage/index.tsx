import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isManagerRole } from "@/lib/members-shared"
import { loadSetup } from "@/lib/module-actions"
import { unmetRequirements } from "@/lib/module-requirements"
import { listContextVersions } from "@/lib/modules-core"
import { getSession } from "@/lib/session"
import { MODULE_KEYS, MODULE_REGISTRY, isModuleKey, pickCopy } from "@/modules/catalog"
import type { SetupSession } from "@/modules/installations"
import { AgentSetupPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url; without them it is the loading view. */
type AgentSetupPageProps = {
    readonly module?: string
    readonly installationId?: string
}

/** The document title of the setup tab. */
export const agentSetupMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_setup") }
}

/** The unresolved draft of a loading screen: empty, never shown. */
const LOADING_SESSION: SetupSession = {
    id: "",
    workspaceId: "",
    installationId: "",
    revision: 0,
    status: "draft",
    draft: { summary: "", facts: [] },
    gateEvidence: {},
    createdAt: "",
}

/**
 * The Setup tab of one instance: its private setup chat with NIVO, the draft, the gate checklist and the versions. Owners and managers
 * only. Chat, sessions and context versions belong to the installation: each instance has its own.
 */
export const AgentSetupPage = async (props: AgentSetupPageProps) => {
    const moduleKey = props.module !== undefined && isModuleKey(props.module) ? props.module : MODULE_KEYS[0]
    const base = { moduleKey, versions: [], unmet: [], revisions: [], messages: [], writes: [] }
    if (props.module === undefined || props.installationId === undefined) {
        return (
            <AgentSetupPageBase
                props={{
                    forbidden: "",
                    setup: {
                        ...base,
                        installationId: "",
                        activeVersionId: null,
                        instance: null,
                        session: LOADING_SESSION,
                        isLoading: true,
                    },
                }}
            />
        )
    }
    if (!isModuleKey(props.module)) notFound()
    const session = await getSession()
    if (!isManagerRole(session.member.role)) {
        const ta = await getTranslations("access")
        return (
            <AgentSetupPageBase
                props={{
                    forbidden: ta("forbidden"),
                    setup: {
                        ...base,
                        installationId: "",
                        activeVersionId: null,
                        instance: null,
                        session: LOADING_SESSION,
                        isLoading: false,
                    },
                }}
            />
        )
    }
    const [state, versions, unmet, localeText] = await Promise.all([
        loadSetup(props.installationId),
        listContextVersions(props.installationId),
        unmetRequirements(props.module),
        getLocale(),
    ])
    if (!state.ok) notFound()
    const locale = localeText === "en" ? "en" : "vi"
    const installation = state.data.installation
    return (
        <AgentSetupPageBase
            props={{
                forbidden: "",
                setup: {
                    moduleKey: props.module,
                    installationId: installation.id,
                    activeVersionId: installation.activeContextVersionId,
                    instance: installation.isMulti
                        ? {
                              name: installation.name,
                              typeName: pickCopy(MODULE_REGISTRY[props.module].shortName, locale),
                          }
                        : null,
                    session: state.data.session,
                    messages: state.data.messages,
                    writes: state.data.writes,
                    revisions: state.data.revisions,
                    versions,
                    unmet: unmet.map((item) => ({
                        label: locale === "en" ? item.label.en : item.label.vi,
                        href: item.href,
                    })),
                    isLoading: false,
                },
            }}
        />
    )
}
