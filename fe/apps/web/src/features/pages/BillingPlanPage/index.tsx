import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { creditsContactHref } from "@/modules/config"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { creditsPath } from "@/modules/routes"
import { BillingPlanPageBase, type BillingPlanPageBaseProps } from "./component"

/** The document title of the page. */
export const billingPlanMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("billing")
    return { title: t("changeTitle") }
}

/** What the page is told: the workspace whose plan changes. */
interface BillingPlanPageProps {
    readonly workspaceId: string
}

/** The words of the header band, resolved on the server so the page and its loading state say the same; no workspace while loading. */
const planCopy = async (workspaceId?: string): Promise<BillingPlanPageBaseProps["props"]> => {
    const t = await getTranslations("billing")
    const c = await getTranslations("credits")
    const shell = await getTranslations("shell")
    return {
        header: {
            title: t("changeTitle"),
            description: t("changeText"),
            breadcrumbs: consoleBreadcrumbsOf({
                workspaceId,
                label: shell("crumbLabel"),
                home: shell("crumbHome"),
                trail: [{ id: "credits", label: c("title"), path: creditsPath() }],
                current: t("changeTitle"),
            }),
        },
        contactHref: creditsContactHref(),
    }
}

/** /billing/plan: change the workspace's plan; the connected block reads the plans and quotes in the browser. */
export const BillingPlanPage = async (props: BillingPlanPageProps): Promise<ReactElement> => (
    <BillingPlanPageBase props={await planCopy(props.workspaceId)} />
)

/** The same page while the route loads: the trail and heading stay real, the plan choice draws its own skeleton. */
export const BillingPlanLoadingPage = async (): Promise<ReactElement> => (
    <BillingPlanPageBase props={await planCopy()} />
)
