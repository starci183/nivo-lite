import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { pageHeadingOf } from "@/modules/page-header"
import { brainTabOf } from "@/modules/brain"
import { DOCUMENT_IDEAS, moduleFilterOf } from "@/modules/documents"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { BrainPageBase } from "./component"
import type { AddPresetView, BrainPageBaseProps } from "./component"

/** The document title of the page. */
export const brainMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brain")
    return { title: t("title") }
}

/** What the page reads from the address: the tab, the fact being written, a fact to give a new value, a question to answer, the idea the add drawer was opened from and the agent filter. */
interface BrainPageProps {
    readonly tab: string | undefined
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
    readonly add: string | undefined
    readonly topic: string | undefined
    readonly tag: string | undefined
    readonly dossier: string | undefined
    readonly finding: string | undefined
    readonly draft: string | undefined
    readonly node: string | undefined
    readonly module: string | undefined
}

type Translate = Awaited<ReturnType<typeof getTranslations<"brain">>>
type KnowledgeTranslate = Awaited<ReturnType<typeof getTranslations<"knowledge">>>
type SecondBrainTranslate = Awaited<ReturnType<typeof getTranslations<"secondBrain">>>

/** The words and links of the page that do not depend on its data or its address. */
type Copy = Pick<BrainPageBaseProps["props"], "header" | "nivoLabel" | "nivoHref" | "readOnlyNote">

/** The words of the page that do not depend on its data. */
const copyOf = (t: Translate, brain: SecondBrainTranslate, knowledge: KnowledgeTranslate): Copy => ({
    header: pageHeadingOf({
        crumbLabel: t("crumbLabel"),
        crumbs: [
            { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
            { id: "brain", label: t("title") },
        ],
        title: t("title"),
        description: brain("intro"),
    }),
    nivoLabel: knowledge("nivoLink"),
    nivoHref: KNOWLEDGE_ROUTES.nivo,
    readOnlyNote: knowledge("readOnlyNote"),
})

/** The drawer, as the address asks for it: closed, open on files, or open on a note about an idea. */
const addOf = (
    knowledge: KnowledgeTranslate,
    props: Pick<BrainPageProps, "add" | "topic" | "tag">,
): Pick<BrainPageBaseProps["props"], "isAddOpen" | "addKey" | "addPreset"> => {
    const add = props.add
    if (add === undefined) return { isAddOpen: false, addKey: "base", addPreset: null }
    if (add === "upload" && props.topic !== undefined) {
        const preset: AddPresetView = {
            topic: props.topic,
            mode: "files",
            ...(props.tag === undefined ? {} : { tags: props.tag }),
        }
        return { isAddOpen: true, addKey: `upload:${props.topic}:${props.tag ?? ""}`, addPreset: preset }
    }
    const idea = DOCUMENT_IDEAS.find((one) => one.key === add)
    if (idea === undefined) return { isAddOpen: true, addKey: "base", addPreset: null }
    const preset: AddPresetView = { topic: knowledge(`suggest_${idea.key}_topic`), visibility: idea.visibility }
    return { isAddOpen: true, addKey: add, addPreset: preset }
}

/** The Second Brain page shell: translates and lays out the page; the connected blocks read their data through GraphQL. */
export const BrainPage = async (props: BrainPageProps) => {
    const [t, brain, knowledge] = await Promise.all([
        getTranslations("brain"),
        getTranslations("secondBrain"),
        getTranslations("knowledge"),
    ])
    return (
        <BrainPageBase
            props={{
                ...copyOf(t, brain, knowledge),
                ...addOf(knowledge, props),
                tab: brainTabOf(props),
                fact: props.fact,
                edit: props.edit,
                answer: props.answer,
                dossier: props.dossier,
                finding: props.finding,
                draft: props.draft,
                node: props.node,
                module: moduleFilterOf(props.module),
            }}
        />
    )
}

/** The same page while it loads: the blocks draw their own skeletons. */
export const BrainLoadingPage = async () => {
    const [t, brain, knowledge] = await Promise.all([
        getTranslations("brain"),
        getTranslations("secondBrain"),
        getTranslations("knowledge"),
    ])
    return (
        <BrainPageBase
            props={{
                ...copyOf(t, brain, knowledge),
                isAddOpen: false,
                addKey: "base",
                addPreset: null,
                tab: "dossiers",
                fact: undefined,
                edit: undefined,
                answer: undefined,
                dossier: undefined,
                finding: undefined,
                draft: undefined,
                node: undefined,
                module: "all",
            }}
        />
    )
}
