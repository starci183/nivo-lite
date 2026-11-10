import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { creditsContactHref } from "@/modules/config"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { CreditsLoadingPageBase, CreditsPageBase } from "./component"

/** The document title of the page. */
export const creditsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("credits")
    return { title: t("title") }
}

/** The words of the header band, resolved on the server so the page and its loading state say the same. */
const creditsHeader = async (workspaceId?: string) => {
    const t = await getTranslations("credits")
    const b = await getTranslations("billing")
    const shell = await getTranslations("shell")
    return {
        header: {
            breadcrumbs: consoleBreadcrumbsOf({
                workspaceId,
                label: shell("crumbLabel"),
                home: shell("crumbHome"),
                current: t("title"),
            }),
            title: t("title"),
            description: t("description"),
        },
        plansLabel: b("comparePlans"),
    }
}

/** What the page is told: the workspace whose credits it shows. */
interface CreditsPageProps {
    readonly workspaceId: string
}

/** Credits and plan; its connected block reads workspace data in the browser. */
export const CreditsPage = async (props: CreditsPageProps): Promise<ReactElement> => (
    <CreditsPageBase
        props={{ header: (await creditsHeader(props.workspaceId)).header, contactHref: creditsContactHref() }}
    />
)

/** The same Page and slot placeholders during route loading. */
export const CreditsLoadingPage = async (): Promise<ReactElement> => (
    <CreditsLoadingPageBase props={await creditsHeader()} />
)
