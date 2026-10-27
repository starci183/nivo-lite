import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { creditsContactHref } from "@/modules/config"
import { AUTH_ROUTES } from "@/modules/routes"
import { BillingPageBase } from "./component"

/** The document title of the page. */
export const billingMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("billing")
    return { title: t("pageTitle") }
}

interface BillingPageProps {
    readonly workspaceId: string
}

/** Server shell for the connected billing overview. */
export const BillingPage = async (props: BillingPageProps) => {
    const t = await getTranslations("billing")
    return (
        <BillingPageBase
            props={{
                workspaceId: props.workspaceId,
                mainLabel: t("pageTitle"),
                homeHref: AUTH_ROUTES.workspaces,
                contactHref: creditsContactHref(),
            }}
        />
    )
}
