import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { creditsContactHref } from "@/modules/config"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { creditsPath } from "@/modules/routes"
import { BillingPlanPageBase } from "./component"

/** The document title of the page. */
export const billingPlanMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("billing")
    return { title: t("changeTitle") }
}

/** What the page is told: the workspace whose plan changes. */
interface BillingPlanPageProps {
    readonly workspaceId: string
}

/** /billing/plan: change the workspace's plan; the connected block reads the plans and quotes in the browser. */
export const BillingPlanPage = async (props: BillingPlanPageProps): Promise<ReactElement> => {
    const t = await getTranslations("billing")
    const c = await getTranslations("credits")
    const shell = await getTranslations("shell")
    return (
        <BillingPlanPageBase
            props={{
                header: {
                    title: t("changeTitle"),
                    description: t("changeText"),
                    breadcrumbs: consoleBreadcrumbsOf({
                        workspaceId: props.workspaceId,
                        label: shell("crumbLabel"),
                        home: shell("crumbHome"),
                        trail: [{ id: "credits", label: c("title"), path: creditsPath() }],
                        current: t("changeTitle"),
                    }),
                },
                contactHref: creditsContactHref(),
            }}
        />
    )
}
