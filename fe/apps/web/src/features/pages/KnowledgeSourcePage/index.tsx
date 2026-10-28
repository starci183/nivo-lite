import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { knowledgeHeadingOf } from "@/modules/page-header"
import type { KnowledgeHeadingInput } from "@/modules/page-header"
import { isKnowledgeId } from "@/modules/documents"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgeSourcePageBase } from "./component"

/** The document title of the page. */
export const knowledgeSourceMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("knowledge")
    return { title: t("title") }
}

/** What the page reads the document from: the `id` segment of the address. */
interface KnowledgeSourcePageProps {
    readonly sourceId: string
}

type Translate = Awaited<ReturnType<typeof getTranslations<"knowledge">>>

/** The props of the connected body: the localized copy and the title the skeleton carries. */
type ClientCopy = KnowledgeHeadingInput

/** The words of the page that do not depend on its data. */
const copyOf = (t: Translate): ClientCopy => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: CONSOLE_ROUTES.dashboard,
    crumbBrain: t("crumbBrain"),
    brainHref: KNOWLEDGE_ROUTES.brain,
    crumbDocuments: t("title"),
    documentsHref: KNOWLEDGE_ROUTES.library,
    eyebrow: t("crumbBrain"),
    description: t("passagesHint"),
    title: t("title"),
})

/** One document with its passages: the connected body reads it through GraphQL; a bad id is not found. */
export const KnowledgeSourcePage = async (props: KnowledgeSourcePageProps) => {
    const t = await getTranslations("knowledge")
    if (!isKnowledgeId(props.sourceId)) notFound()
    return <KnowledgeSourcePageBase props={{ header: knowledgeHeadingOf(copyOf(t)), sourceId: props.sourceId }} />
}

/** The same page while it loads: the overview draws its own skeleton. */
export const KnowledgeSourceLoadingPage = async () => {
    const t = await getTranslations("knowledge")
    return <KnowledgeSourcePageBase props={{ header: knowledgeHeadingOf(copyOf(t)), sourceId: undefined }} />
}
