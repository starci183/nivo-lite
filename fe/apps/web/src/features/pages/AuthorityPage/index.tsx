import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { paneGridOf } from "@/hooks/paneFrame"
import { AUTHORITY_SECTIONS, type AuthoritySectionId } from "@/modules/authority"
import { AuthorityPageBase } from "./component"

/** The document title of the authority page. */
export const authorityPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("authority")
    return { title: t("title") }
}

/** What the authority route is given: the section its address names, or none on the base address (a phone then shows the list). */
interface AuthorityPageProps {
    readonly section?: AuthoritySectionId
}

/** The authority route: the five sections as a list and the named one beside it; each section's form reads and saves through the back end in the browser. */
export const AuthorityPage = async (props: AuthorityPageProps): Promise<ReactElement> => {
    const t = await getTranslations("authority")
    return (
        <AuthorityPageBase
            props={{
                title: t("title"),
                description: t("description"),
                gridLabel: t("gridLabel"),
                listTitle: t("listTitle"),
                listLabel: t("listLabel"),
                detailLabel: t("detailLabel"),
                grid: paneGridOf({
                    hasList: true,
                    hasAside: false,
                    phone: props.section === undefined ? "list" : "main",
                }),
                open: props.section ?? "goals",
                sections: AUTHORITY_SECTIONS,
            }}
        />
    )
}
