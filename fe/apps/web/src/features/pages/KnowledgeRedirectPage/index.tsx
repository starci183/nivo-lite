import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { moduleFilterOf } from "@/modules/documents"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"

/** The document title while the old documents address is forwarded. */
export const knowledgeRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brain")
    return { title: t("title") }
}

/** What the old address carried: the agent filter and the idea the add drawer opened on. */
interface KnowledgeRedirectPageProps {
    readonly module: string | undefined
    readonly add: string | undefined
}

/** Moved: the documents are the sources tab of the Second Brain, so the old address forwards there and keeps its filter and its drawer. */
export const KnowledgeRedirectPage = async (props: KnowledgeRedirectPageProps) => {
    const filter = moduleFilterOf(props.module)
    return navigation.redirect({
        href: brainTabHref("sources", { module: filter === "all" ? undefined : filter, add: props.add }),
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
}
