import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { brainTabOf, legacyBrainHrefOf } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, FIRST_PAGE, brainStripTabOf, workspaceHref, type BrainStripTab, type BrainTab } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { BrainAddressBody } from "./AddressBody"
import { BrainPageBase, type BrainPageBaseProps } from "./component"

/** The document title of the page. */
export const brainMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brain")
    return { title: t("title") }
}

/** What the page reads from the address: the tab and the view inside it, the fact being written, a fact to give a new value, a question to answer and the public document forms. */
interface BrainPageProps {
    /** The workspace of the address. */
    readonly workspaceId: string
    readonly tab: string | undefined
    readonly view: string | undefined
    /** Every parameter of the address, kept when an old address is forwarded. */
    readonly params: Readonly<Record<string, string | undefined>>
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
    readonly lesson: string | undefined
    readonly compose: string | undefined
    readonly title: string | undefined
    readonly doc: string | undefined
    /** The shop rule open in the drawer of the policies tab. */
    readonly policy: string | undefined
}

type Translate = Awaited<ReturnType<typeof getTranslations<"brain">>>
type SecondBrainTranslate = Awaited<ReturnType<typeof getTranslations<"secondBrain">>>

/** The words and links of the page that do not depend on its data or its address. */
type Copy = Pick<BrainPageBaseProps["props"], "header">

/** The supporting line under the heading of each tab of the strip. */
const INTRO_KEY: Readonly<
    Record<BrainStripTab, "intro" | "introPolicies" | "introKnowledge" | "introPublic" | "introAsk">
> = {
    todo: "intro",
    policies: "introPolicies",
    knowledge: "introKnowledge",
    public: "introPublic",
    ask: "introAsk",
}

/** The words of the page that do not depend on its data. */
const copyOf = (t: Translate, brain: SecondBrainTranslate, tab: BrainTab, workspaceId?: string): Copy => ({
    header: {
        breadcrumbs: {
            label: t("crumbLabel"),
            items: [
                {
                    id: "home",
                    label: t("crumbHome"),
                    ...(workspaceId === undefined
                        ? {}
                        : { href: workspaceHref(workspaceId, CONSOLE_ROUTES.workspaceHome) }),
                },
                { id: "brain", label: t("title") },
            ],
        },
        title: t("title"),
        description: brain(INTRO_KEY[brainStripTabOf(tab)]),
    },
})

/** The public document form the address asks for: the picker of internal documents, the written form, or none. */
const composeOf = (value: string | undefined): "pick" | "write" | undefined => {
    if (value === "pick") return "pick"
    return value === "write" ? "write" : undefined
}

/** The Second Brain page shell: translates and lays out the page; the connected blocks read their data through GraphQL. */
export const BrainPage = async (props: BrainPageProps): Promise<ReactElement> => {
    const legacy = legacyBrainHrefOf({ tab: props.tab, view: props.view, answer: props.answer, params: props.params })
    if (legacy !== null)
        navigation.redirect({
            href: workspaceHref(props.workspaceId, legacy),
            locale: (await getLocale()) === "en" ? "en" : "vi",
        })
    const tab = brainTabOf(props)
    const [t, brain] = await Promise.all([getTranslations("brain"), getTranslations("secondBrain")])
    return (
        <BrainPageBase
            props={{
                ...copyOf(t, brain, tab, props.workspaceId),
                tab,
                fact: props.fact,
                edit: props.edit,
                answer: props.answer,
                lesson: props.lesson,
                compose: composeOf(props.compose),
                composeTitle: props.title ?? "",
                publicDoc: props.doc,
                policy: props.policy,
            }}
        />
    )
}

/** The same page while it loads: a boundary knows no address, so every tab's heading is translated and the browser's address picks the tab; the blocks draw their own skeletons. */
export const BrainLoadingPage = async (): Promise<ReactElement> => {
    const [t, brain] = await Promise.all([getTranslations("brain"), getTranslations("secondBrain")])
    const headingOf = (tab: BrainStripTab): BrainPageHeading => copyOf(t, brain, FIRST_PAGE[tab]).header
    const headings: Record<BrainStripTab, BrainPageHeading> = {
        todo: headingOf("todo"),
        policies: headingOf("policies"),
        knowledge: headingOf("knowledge"),
        public: headingOf("public"),
        ask: headingOf("ask"),
    }
    return <BrainAddressBody headings={headings} />
}
