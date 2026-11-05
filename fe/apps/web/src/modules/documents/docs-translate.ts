import type { useFormatter, useTranslations } from "next-intl"

/** The translator of the `knowledge` namespace. */
export type KnowledgeTranslate = ReturnType<typeof useTranslations<"knowledge">>

/** The date formatter of the active language. */
export type KnowledgeFormat = ReturnType<typeof useFormatter>
