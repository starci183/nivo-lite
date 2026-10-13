import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { BrainPageBase } from "./component"
import type { BrainPageBaseProps } from "./component"

/** The document title of the page. */
export const brainMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brain")
    return { title: t("title") }
}

/** What the page reads from the address: the fact being written, a fact to give a new value, a question to answer. */
interface BrainPageProps {
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

type Translate = Awaited<ReturnType<typeof getTranslations<"brain">>>

/** The props of the connected overview: the localized copy. */
type ClientCopy = Omit<BrainPageBaseProps["props"], "fact" | "edit" | "answer">

/** The words of the page that do not depend on its data. */
const copyOf = (t: Translate): ClientCopy => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: CONSOLE_ROUTES.dashboard,
    eyebrow: t("title"),
    title: t("title"),
    description: t("intro"),
    documentsLabel: t("knowledgeLink"),
    documentsHref: KNOWLEDGE_ROUTES.library,
})

/** The Second Brain page shell: translates and lays out the page; the connected overview reads its data through GraphQL. */
export const BrainPage = async (props: BrainPageProps) => {
    const t = await getTranslations("brain")
    return <BrainPageBase props={{ ...copyOf(t), fact: props.fact, edit: props.edit, answer: props.answer }} />
}

/** The same page while it loads: the overview draws its own skeletons. */
export const BrainLoadingPage = async () => {
    const t = await getTranslations("brain")
    return <BrainPageBase props={{ ...copyOf(t), fact: undefined, edit: undefined, answer: undefined }} />
}
