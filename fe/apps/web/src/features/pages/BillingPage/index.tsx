import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { BillingOverview } from "@/components/blocks/BillingOverview"
import { BillingCreditPacks } from "@/components/blocks/BillingCreditPacks"
import { BillingPlans } from "@/components/blocks/BillingPlans"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"
import { creditsContactHref } from "@/modules/config"
import { AUTH_ROUTES } from "@/modules/routes"

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
        <WorkspacesFrame
            homeHref={AUTH_ROUTES.workspaces}
            mainLabel={t("pageTitle")}
            logo={<BrandLogo variant="full" height={44} />}
            localeSwitch={<LocaleSwitch />}
            account={<WorkspacesAccount />}
        >
            <BillingOverview workspaceId={props.workspaceId} />
            <BillingPlans workspaceId={props.workspaceId} contactHref={creditsContactHref()} />
            <BillingCreditPacks workspaceId={props.workspaceId} />
        </WorkspacesFrame>
    )
}
