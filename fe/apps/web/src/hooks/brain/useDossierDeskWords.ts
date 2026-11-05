import { useTranslations } from "next-intl"
import { DOSSIER_STATUS_TONE, statusCountsOf } from "@/modules/brain"
import type {
    CategoryView,
    DossierDeskView,
    DossierDocumentView,
    DossierRowView,
    DossierSource,
    DossierView,
    Standing,
} from "@/modules/brain"
import { knowledgeSourceHref } from "@/modules/routes"

type Translate = ReturnType<typeof useTranslations<"secondBrain">>
type DeskTranslate = ReturnType<typeof useTranslations<"brainDossiers">>
type ReviewTranslate = ReturnType<typeof useTranslations<"dossierReview">>
type KnowledgeTranslate = ReturnType<typeof useTranslations<"knowledge">>

/** The words the desk draws its rows and its head with. */
export interface DeskWords {
    readonly t: Translate
    readonly desk: DeskTranslate
    readonly review: ReviewTranslate
    readonly knowledge: KnowledgeTranslate
}

/** The words of a status chip: a dossier the checklist holds but no document backs says so. */
const statusLabelOf = (t: Translate, standing: Standing, documentCount: number): string =>
    t(standing.status === "present" && documentCount === 0 ? "statusPresentNoFile" : `status_${standing.status}`)

/** What the checklist says about a dossier, in words: what is missing, or what is already held; null when it says neither. */
const checklistNoteOf = (words: DeskWords, dossier: DossierView): string | null => {
    if (dossier.note === null) return null
    return dossier.note.kind === "missing" ? words.t("dossierMissing", { text: dossier.note.text }) : dossier.note.text
}

/** The one line under a dossier's name: what is missing (or held), how many documents it has, how many findings are open. */
const noteOf = (words: DeskWords, dossier: DossierView, openCount: number): string => {
    const parts = [
        checklistNoteOf(words, dossier),
        words.desk("rowDocuments", { count: dossier.documentCount }),
        openCount > 0 ? words.review("findingsCount", { count: openCount }) : null,
    ]
    return parts.filter((part) => part !== null).join(" · ")
}

/** The kinds of document the documents list names. */
const SOURCE_KINDS = ["text", "faq", "file", "url"] as const

/** The word for a kind of document; a kind the app does not know is named as the read gave it. */
const kindLabelOf = (knowledge: KnowledgeTranslate, kind: string): string => {
    const known = SOURCE_KINDS.find((one) => one === kind)
    return known === undefined ? kind : knowledge(`kind_${known}`)
}

/** The figures of the whole set: how many dossiers stand at each status, and how many questions wait for the owner. */
const figuresOf = (
    words: DeskWords,
    categories: ReadonlyArray<CategoryView>,
    standingOf: (dossier: DossierView) => Standing,
    activeCount: number,
): DossierDeskView["list"]["figures"] => [
    ...statusCountsOf(categories, (one) => standingOf(one).status)
        .filter((one) => one.count > 0 || ["present", "partial", "missing"].includes(one.status))
        .map((one) => ({ id: one.status, label: words.t(`status_${one.status}`), value: String(one.count) })),
    { id: "ask", label: words.t("figureAsk"), value: String(activeCount) },
]

/** The words of the desk, bound to the active language. */
export interface DossierDeskWords {
    readonly words: DeskWords
    readonly statusLabelOf: (standing: Standing, documentCount: number) => string
    readonly noteOf: (dossier: DossierView, openCount: number) => string
    readonly kindLabelOf: (kind: string) => string
    readonly figuresOf: (
        categories: ReadonlyArray<CategoryView>,
        standingOf: (dossier: DossierView) => Standing,
        activeCount: number,
    ) => DossierDeskView["list"]["figures"]
    readonly rowOf: (dossier: DossierView, standing: Standing, openCount: number) => DossierRowView
    readonly documentOf: (source: DossierSource) => DossierDocumentView
}

/** The words the dossiers desk draws its rows, figures, head and side pane with, in the active language. */
export const useDossierDeskWords = (): DossierDeskWords => {
    const words: DeskWords = {
        t: useTranslations("secondBrain"),
        desk: useTranslations("brainDossiers"),
        review: useTranslations("dossierReview"),
        knowledge: useTranslations("knowledge"),
    }
    return {
        words,
        statusLabelOf: (standing, documentCount) => statusLabelOf(words.t, standing, documentCount),
        noteOf: (dossier, openCount) => noteOf(words, dossier, openCount),
        kindLabelOf: (kind) => kindLabelOf(words.knowledge, kind),
        figuresOf: (categories, standingOf, activeCount) => figuresOf(words, categories, standingOf, activeCount),
        rowOf: (dossier, standing, openCount) => ({
            id: dossier.id,
            name: dossier.name,
            note: noteOf(words, dossier, openCount),
            badge: {
                label: statusLabelOf(words.t, standing, dossier.documentCount),
                tone: DOSSIER_STATUS_TONE[standing.status],
            },
        }),
        documentOf: (source) => ({
            id: source.id,
            title: source.title,
            meta: words.desk("documentMeta", {
                kind: kindLabelOf(words.knowledge, source.kind),
                count: source.chunkCount,
            }),
            href: knowledgeSourceHref(source.id),
        }),
    }
}
