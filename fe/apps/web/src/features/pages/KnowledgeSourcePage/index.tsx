import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { isKnowledgeId, readKnowledgeSource } from "@/modules/db"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgeSourcePageBase } from "./component"
import type { KnowledgeSourcePageBaseProps } from "./component"

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

/** The words of the page that do not depend on its data. */
const copyOf = (
    t: Translate,
): Omit<KnowledgeSourcePageBaseProps["props"], "workspaceId" | "canWrite" | "source" | "chunks" | "title"> => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: CONSOLE_ROUTES.dashboard,
    crumbBrain: t("crumbBrain"),
    brainHref: KNOWLEDGE_ROUTES.brain,
    crumbDocuments: t("title"),
    documentsHref: KNOWLEDGE_ROUTES.library,
    eyebrow: t("crumbBrain"),
    description: t("passagesHint"),
})

/** One document with its passages: read under RLS; a document that is not in the workspace is not found. */
export const KnowledgeSourcePage = async (props: KnowledgeSourcePageProps) => {
    const [t, session] = await Promise.all([getTranslations("knowledge"), getSession()])
    if (!isKnowledgeId(props.sourceId)) notFound()
    const found = await readKnowledgeSource(session.workspace.id, props.sourceId)
    if (found.kind === "not-found") notFound()
    if (found.kind !== "ok") throw new Error(`knowledge: ${found.kind} ${found.code}`)
    return (
        <KnowledgeSourcePageBase
            props={{
                ...copyOf(t),
                title: found.value.source.title,
                workspaceId: session.workspace.id,
                canWrite: isManagerRole(session.member.role),
                source: found.value.source,
                chunks: found.value.chunks,
            }}
        />
    )
}

/** The same page while its data loads. */
export const KnowledgeSourceLoadingPage = async () => {
    const t = await getTranslations("knowledge")
    return (
        <KnowledgeSourcePageBase
            props={{ ...copyOf(t), title: t("title"), workspaceId: "", canWrite: false, source: null, chunks: [] }}
        />
    )
}
