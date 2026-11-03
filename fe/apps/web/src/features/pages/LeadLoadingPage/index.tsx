import { getTranslations } from "next-intl/server"
import { LeadContext } from "@/components/blocks/LeadContext"
import { LeadExecution } from "@/components/blocks/LeadExecution"
import { LeadHistory } from "@/components/blocks/LeadHistory"
import { LeadOutcome } from "@/components/blocks/LeadOutcome"
import { LeadPageHead } from "@/components/blocks/LeadPageHead"
import { LeadPreviousSteps } from "@/components/blocks/LeadPreviousSteps"
import { LeadResponsibility } from "@/components/blocks/LeadResponsibility"
import { LeadWorkFlow } from "@/components/blocks/LeadWorkFlow"
import { LeadPageLayout } from "@/components/composites/LeadPageLayout"
import { LEADS_ROUTES } from "@/modules/routes"

/** The lead page with no data yet: the same trail, panels and section titles, every value a skeleton. */
export const LeadLoadingPage = async () => {
    const t = await getTranslations("leads")
    return (
        <LeadPageHead
            crumbLabel={t("crumbLabel")}
            crumbs={[
                { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                { id: "leads", label: t("title"), href: LEADS_ROUTES.leads },
            ]}
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
        </LeadPageHead>
    )
}
