import { Page } from "@starci/grammar/common"
import { getTranslations } from "next-intl/server"
import { LeadContext } from "@/components/blocks/LeadContext"
import { LeadExecution } from "@/components/blocks/LeadExecution"
import { LeadHeader } from "@/components/blocks/LeadHeader"
import { LeadHeaderActions } from "@/components/blocks/LeadHeaderActions"
import { LeadHistory } from "@/components/blocks/LeadHistory"
import { LeadOutcome } from "@/components/blocks/LeadOutcome"
import { LeadPreviousSteps } from "@/components/blocks/LeadPreviousSteps"
import { LeadResponsibility } from "@/components/blocks/LeadResponsibility"
import { LeadWorkFlow } from "@/components/blocks/LeadWorkFlow"
import { LeadPageLayout } from "@/components/composites/LeadPageLayout"
import { LEADS_ROUTES } from "@/modules/routes"

/** The lead page with no data yet: the same trail, panels and section titles, every value a skeleton. */
export const LeadLoadingPage = async () => {
    const t = await getTranslations("leads")
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: {
                    label: t("crumbLabel"),
                    items: [
                        { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                        { id: "leads", label: t("title"), href: LEADS_ROUTES.leads },
                        { id: "lead", label: "", isSkeleton: true },
                    ],
                },
                mark: <LeadHeader part="mark" />,
                title: <LeadHeader part="title" />,
                status: <LeadHeader part="status" />,
                description: <LeadHeader part="description" />,
                actions: <LeadHeaderActions />,
            }}
        >
            <LeadPageLayout
                primary={
                    <>
                        <LeadExecution />
                        <LeadWorkFlow />
                        <LeadHistory />
                    </>
                }
                rail={
                    <>
                        <LeadResponsibility />
                        <LeadPreviousSteps />
                        <LeadContext />
                        <LeadOutcome />
                    </>
                }
            />
        </Page>
    )
}
