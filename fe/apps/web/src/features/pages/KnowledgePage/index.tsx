import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DOCUMENT_IDEAS, moduleFilterOf } from "@/modules/documents"
import type { AddPreset } from "@/hooks/knowledge"
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
): Omit<KnowledgePageBaseProps["props"], "module" | "isAddOpen" | "addKey" | "addPreset"> => ({
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

/** The documents page shell: translates and lays out the page; the connected overview reads its data through GraphQL. */
export const KnowledgePage = async (props: KnowledgePageProps) => {
    const t = await getTranslations("knowledge")
    return <KnowledgePageBase props={{ ...copyOf(t), ...addOf(t, props.add), module: moduleFilterOf(props.module) }} />
}

/** The same page while it loads: the overview draws its own skeletons. */
export const KnowledgeLoadingPage = async () => {
    const t = await getTranslations("knowledge")
    return (
        <KnowledgePageBase
            props={{ ...copyOf(t), isAddOpen: false, addKey: "closed", addPreset: null, module: "all" }}
        />
    )
}
