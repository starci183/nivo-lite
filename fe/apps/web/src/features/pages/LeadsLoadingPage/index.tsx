import { Button, Page } from "@starci/grammar/common"
import { getTranslations } from "next-intl/server"
import { LeadsBoard } from "@/components/blocks/LeadsBoard"
import { LeadsPageLayout } from "@/components/composites/LeadsPageLayout"
import { LEADS_ROUTES, newLeadPath } from "@/modules/routes"

/** The Leads page with no data yet: the same heading, filters and tabs, the list as skeleton rows. */
export const LeadsLoadingPage = async () => {
    const t = await getTranslations("leads")
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: {
                    label: t("crumbLabel"),
                    items: [
                        { id: "home", label: t("crumbHome"), href: LEADS_ROUTES.dashboard },
                        { id: "leads", label: t("title") },
                    ],
                },
                title: t("title"),
                description: t("descriptionShort"),
                actions: (
                    <Button intent="commit" href={newLeadPath()}>
                        {t("newLead")}
                    </Button>
                ),
            }}
        >
            <LeadsPageLayout form={null} board={<LeadsBoard initialQuery="" />} promo={null} />
        </Page>
    )
}
