import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { readNivoKnowledge } from "@/modules/db"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgeNivoPageBase } from "./component"
import type { KnowledgeNivoPageBaseProps } from "./component"

/** The document title of the page. */
export const knowledgeNivoMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("knowledge")
    return { title: t("nivoTitle") }
}

type Translate = Awaited<ReturnType<typeof getTranslations<"knowledge">>>

/** The words of the page that do not depend on its data. */
const copyOf = (t: Translate): Omit<KnowledgeNivoPageBaseProps["props"], "items" | "isLoading"> => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: CONSOLE_ROUTES.dashboard,
    crumbBrain: t("crumbBrain"),
    brainHref: KNOWLEDGE_ROUTES.brain,
    crumbDocuments: t("title"),
    documentsHref: KNOWLEDGE_ROUTES.library,
    eyebrow: t("crumbBrain"),
    title: t("nivoTitle"),
    description: t("nivoDescription"),
})

/** The base knowledge of NIVO per module: read under RLS, read-only for every member. */
export const KnowledgeNivoPage = async () => {
    const [t, items] = await Promise.all([getTranslations("knowledge"), readNivoKnowledge()])
    if (items.kind !== "ok") throw new Error(`knowledge: ${items.kind} ${items.code}`)
    return <KnowledgeNivoPageBase props={{ ...copyOf(t), items: items.value, isLoading: false }} />
}

/** The same page while its data loads. */
export const KnowledgeNivoLoadingPage = async () => {
    const t = await getTranslations("knowledge")
    return <KnowledgeNivoPageBase props={{ ...copyOf(t), items: [], isLoading: true }} />
}
