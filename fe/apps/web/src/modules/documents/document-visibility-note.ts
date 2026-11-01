import type { useTranslations } from "next-intl"
import type { DocumentVisibility } from "@/modules/types"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** What the choice means for the answers; before a choice it says what the chatbot reads and what NIVO suggests. */
export const visibilityNoteOf = (
    t: Translate,
    chosen: DocumentVisibility | null,
    suggested: DocumentVisibility | null,
): string => {
    if (chosen !== null) return t(chosen === "public" ? "visPublicNote" : "visInternalNote")
    if (suggested === null) return t("visNoneNote")
    return t("visNoneNote") + " " + t(suggested === "public" ? "visSuggestPublic" : "visSuggestInternal")
}
