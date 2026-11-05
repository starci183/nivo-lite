import type { ReactElement } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { brainHeadingOf } from "@/modules/brain"
import { isKnowledgeId } from "@/modules/documents"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
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

/** The words of the heading that do not depend on its data. */
const headingOf = async (): Promise<BrainPageHeading> => {
    const [t, brain] = await Promise.all([getTranslations("brain"), getTranslations("secondBrain")])
    return brainHeadingOf({
        crumbLabel: t("crumbLabel"),
        crumbHome: t("crumbHome"),
        homeHref: CONSOLE_ROUTES.dashboard,
        title: t("title"),
        description: brain("intro"),
    })
}

/** One document with its passages: the connected screen reads it through GraphQL; a bad id is not found. */
export const KnowledgeSourcePage = async (props: KnowledgeSourcePageProps): Promise<ReactElement> => {
    if (!isKnowledgeId(props.sourceId)) notFound()
    return <KnowledgeSourcePageBase props={{ heading: await headingOf(), sourceId: props.sourceId }} />
}

/** The same page while it loads: the screen draws its own skeleton. */
export const KnowledgeSourceLoadingPage = async (): Promise<ReactElement> => (
    <KnowledgeSourcePageBase props={{ heading: await headingOf(), sourceId: undefined }} />
)
