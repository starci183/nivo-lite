import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { brainPartOf, brainTabOf, legacyBrainHrefOf } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { BrainPageBase } from "./component"
import type { BrainPageBaseProps } from "./component"

/** The document title of the page. */
export const brainMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brain")
    return { title: t("title") }
}

/** What the page reads from the address: the tab, the fact being written, a fact to give a new value, a question to answer, the dossier, the finding, the draft, the node on the map and the public document forms. */
interface BrainPageProps {
    readonly tab: string | undefined
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
    readonly dossier: string | undefined
    readonly finding: string | undefined
    readonly draft: string | undefined
    readonly node: string | undefined
    readonly compose: string | undefined
    readonly title: string | undefined
    readonly doc: string | undefined
}

type Translate = Awaited<ReturnType<typeof getTranslations<"brain">>>
type SecondBrainTranslate = Awaited<ReturnType<typeof getTranslations<"secondBrain">>>

/** The words and links of the page that do not depend on its data or its address. */
type Copy = Pick<BrainPageBaseProps["props"], "header">

/** The words of the page that do not depend on its data. */
const copyOf = (t: Translate, brain: SecondBrainTranslate, tab: BrainTab): Copy => ({
    header: {
        breadcrumbs: {
            label: t("crumbLabel"),
            items: [
                { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                { id: "brain", label: t("title") },
            ],
        },
        title: t("title"),
        description: brain(brainPartOf(tab) === "public" ? "introPublic" : "intro"),
    },
})

/** The public document form the address asks for: the picker of internal documents, the written form, or none. */
const composeOf = (value: string | undefined): "pick" | "write" | undefined => {
    if (value === "pick") return "pick"
    return value === "write" ? "write" : undefined
}

/** The Second Brain page shell: translates and lays out the page; the connected blocks read their data through GraphQL. */
export const BrainPage = async (props: BrainPageProps): Promise<ReactElement> => {
    const legacy = legacyBrainHrefOf(props)
    if (legacy !== null) navigation.redirect({ href: legacy, locale: (await getLocale()) === "en" ? "en" : "vi" })
    const tab = brainTabOf(props)
    const [t, brain] = await Promise.all([getTranslations("brain"), getTranslations("secondBrain")])
    return (
        <BrainPageBase
            props={{
                ...copyOf(t, brain, tab),
                tab,
                fact: props.fact,
                edit: props.edit,
                answer: props.answer,
                dossier: props.dossier,
                finding: props.finding,
                draft: props.draft,
                node: props.node,
                compose: composeOf(props.compose),
                composeTitle: props.title ?? "",
                publicDoc: props.doc,
            }}
        />
    )
}

/** The same page while it loads: the blocks draw their own skeletons. */
export const BrainLoadingPage = async (): Promise<ReactElement> => {
    const [t, brain] = await Promise.all([getTranslations("brain"), getTranslations("secondBrain")])
    return (
        <BrainPageBase
            props={{
                ...copyOf(t, brain, "todo"),
                tab: "todo",
                fact: undefined,
                edit: undefined,
                answer: undefined,
                dossier: undefined,
                finding: undefined,
                draft: undefined,
                node: undefined,
                compose: undefined,
                composeTitle: "",
                publicDoc: undefined,
            }}
        />
    )
}
