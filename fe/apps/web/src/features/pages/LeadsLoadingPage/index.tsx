import { LeadsBoard } from "@/components/blocks/LeadsBoard"
import { LeadsHeading } from "@/components/blocks/LeadsHeading"
import { LeadsPageLayout } from "@/components/composites/LeadsPageLayout"

/** The Leads page with no data yet: the same heading, filters and tabs, the list as skeleton rows. */
export const LeadsLoadingPage = () => (
    <LeadsPageLayout
        heading={<LeadsHeading isFormOpen={false} />}
        form={null}
        board={<LeadsBoard leads={{ isLoading: true }} nowIso="" initialQuery="" />}
        promo={null}
    />
)
