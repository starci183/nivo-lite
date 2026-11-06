import type { useTranslations } from "next-intl"
import { DOCUMENT_STATUS_KEYS, isDocumentActive } from "@/modules/documents"
import type { BrainExtraction, KnowledgeDocument } from "@/modules/types"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** What the words of a document's standing are made from: the document, whether its facts were read, and how many they gave. */
export interface SourceStatusInput {
    /** The document. */
    readonly source: KnowledgeDocument
    /** How reading its facts went; undefined while it is not known. */
    readonly reading: BrainExtraction["status"] | undefined
    /** How many facts it gave, when the viewer may see them; null when not. */
    readonly learnedFacts: number | null
}

/**
 * Where a document stands in one word: still being read, learnt (with how many facts it gave, when the viewer may see them),
 * failed, or what else holds it back.
 */
export const sourceStatusLabelOf = (t: Translate, input: SourceStatusInput): string => {
    const { source, reading, learnedFacts } = input
    if (isDocumentActive(source.status)) return t("libReading")
    if (source.status === "failed") return t("libFailed")
    if (source.status !== "ready") return t(DOCUMENT_STATUS_KEYS[source.status])
    if (reading !== "done") return t("libFactsNone")
    return learnedFacts === null ? t("libLearnedPlain") : t("libLearned", { count: learnedFacts })
}
