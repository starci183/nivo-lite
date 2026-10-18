import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { readLegalSections, type LegalDocKey } from "@/hooks/legal"
import { LegalPageBase } from "./component"

/** Which document the route serves. */
interface LegalPageProps {
    readonly doc: LegalDocKey
}

/** The document title of a legal page: the document's name and the product. */
export const legalMetadata = async (doc: LegalDocKey): Promise<Metadata> => {
    const t = await getTranslations("legal")
    const title = t(`${doc}.title`)
    return { title: `${title} - ${t("siteName")}` }
}

/** The public legal document with its wording resolved on the server. */
export const LegalPage = async (props: LegalPageProps) => {
    const t = await getTranslations("legal")
    return (
        <LegalPageBase
            props={{
                mainLabel: t(`${props.doc}.title`),
                title: t(`${props.doc}.title`),
                draft: t(`${props.doc}.draft`),
                intro: t(`${props.doc}.intro`),
                sections: readLegalSections(t.raw(`${props.doc}.sections`)).map((section) => ({
                    id: section.id,
                    title: section.title,
                    paragraphs: section.paragraphs,
                    items: section.items,
                    afterItems: section.afterItems,
                    hasLimitedUse: section.limitedUse,
                })),
                limitedUse: {
                    sentence: t("limitedUseSentence"),
                    policyUrl: t("policyUrl"),
                    note: t("limitedUseNote"),
                },
            }}
        />
    )
}
