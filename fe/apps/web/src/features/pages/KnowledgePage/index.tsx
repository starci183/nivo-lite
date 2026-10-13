import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { AGENT_MODULES, DOCUMENT_IDEAS, instanceOptions, moduleFilterOf, ideasFor, topicsOf } from "@/hooks/knowledge"
import type { AddPreset } from "@/hooks/knowledge"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { readInstallations, readKnowledgeSources, readSuggestionContext } from "@/modules/db"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgePageBase } from "./component"
import type { KnowledgePageBaseProps } from "./component"

/** The document title of the page. */
export const knowledgeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("knowledge")
    return { title: t("title") }
}

/** What the page reads from the address: the agent filter and the idea the add drawer was opened from. */
interface KnowledgePageProps {
    readonly module: string | undefined
    readonly add: string | undefined
}

type Translate = Awaited<ReturnType<typeof getTranslations<"knowledge">>>

/** The words of the page that do not depend on its data. */
const copyOf = (
    t: Translate,
): Pick<
    KnowledgePageBaseProps["props"],
    | "crumbLabel"
    | "crumbHome"
    | "homeHref"
    | "crumbBrain"
    | "brainHref"
    | "eyebrow"
    | "title"
    | "description"
    | "nivoLabel"
    | "nivoHref"
    | "readOnlyNote"
> => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: CONSOLE_ROUTES.dashboard,
    crumbBrain: t("crumbBrain"),
    brainHref: KNOWLEDGE_ROUTES.brain,
    eyebrow: t("crumbBrain"),
    title: t("title"),
    description: t("description"),
    nivoLabel: t("nivoLink"),
    nivoHref: KNOWLEDGE_ROUTES.nivo,
    readOnlyNote: t("readOnlyNote"),
})

/** The drawer, as the address asks for it: closed, open on files, or open on a note about an idea. */
const addOf = (
    t: Translate,
    add: string | undefined,
): Pick<KnowledgePageBaseProps["props"], "isAddOpen" | "addKey" | "addPreset"> => {
    if (add === undefined) return { isAddOpen: false, addKey: "closed", addPreset: null }
    const idea = DOCUMENT_IDEAS.find((one) => one.key === add)
    const preset: AddPreset | null =
        idea === undefined ? null : { topic: t(`suggest_${idea.key}_topic`), visibility: idea.visibility }
    return { isAddOpen: true, addKey: add, addPreset: preset }
}

/** The documents page body: everyone reads, owners and managers write. Reads the documents under RLS; a worker moves them on in the back end. */
export const KnowledgePage = async (props: KnowledgePageProps) => {
    const [t, session, locale] = await Promise.all([getTranslations("knowledge"), getSession(), getLocale()])
    const workspaceId = session.workspace.id
    const canWrite = isManagerRole(session.member.role)
    const [sources, installations, context] = await Promise.all([
        readKnowledgeSources(workspaceId),
        readInstallations(workspaceId),
        canWrite ? readSuggestionContext(workspaceId) : Promise.resolve(null),
    ])
    if (sources.kind !== "ok") throw new Error(`knowledge: ${sources.kind} ${sources.code}`)
    if (installations.kind !== "ok") throw new Error(`knowledge: ${installations.kind} ${installations.code}`)
    if (context !== null && context.kind !== "ok") throw new Error(`knowledge: ${context.kind} ${context.code}`)
    const decided = context === null ? new Map() : context.value.states
    const installed = installations.value.map((one) => one.moduleKey)
    const used = new Set(topicsOf(sources.value).map((topic) => topic.toLowerCase()))
    const fitting = canWrite ? ideasFor(installed, context === null ? null : context.value.businessType) : []
    const filter = moduleFilterOf(props.module)
    return (
        <KnowledgePageBase
            props={{
                ...copyOf(t),
                ...addOf(t, props.add),
                workspaceId,
                canWrite,
                sources: sources.value,
                module: filter,
                askModule: filter === "all" ? (installed[0] ?? AGENT_MODULES[0] ?? "chatbot") : filter,
                instances: instanceOptions(installations.value, locale === "en" ? "en" : "vi"),
                open: fitting
                    .filter((one) => !decided.has(one.key) && !used.has(t(`suggest_${one.key}_topic`).toLowerCase()))
                    .map((one) => ({ key: one.key })),
                skipped: fitting.flatMap((one) => {
                    const state = decided.get(one.key)
                    return state === undefined ? [] : [{ key: one.key, state }]
                }),
                isLoading: false,
            }}
        />
    )
}

/** The same page while its data loads: labels stay, the documents and ideas are skeletons. */
export const KnowledgeLoadingPage = async () => {
    const t = await getTranslations("knowledge")
    return (
        <KnowledgePageBase
            props={{
                ...copyOf(t),
                ...addOf(t, undefined),
                workspaceId: "",
                canWrite: false,
                sources: [],
                module: "all",
                askModule: "chatbot",
                instances: [],
                open: [],
                skipped: [],
                isLoading: true,
            }}
        />
    )
}
