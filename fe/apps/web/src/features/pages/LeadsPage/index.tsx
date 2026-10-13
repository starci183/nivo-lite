import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LeadCreateForm } from "@/components/blocks/LeadCreateForm"
import { LeadsBoard } from "@/components/blocks/LeadsBoard"
import { LeadsHeading } from "@/components/blocks/LeadsHeading"
import { LeadsPageLayout } from "@/components/composites/LeadsPageLayout"
import { LeadsPromoRow } from "@/features/promo-ads/LeadsPromoRow"
import { getSession } from "@/lib/session"
import { CHANNEL_KEYS, readLeads } from "@/modules/db"
import { toSlot } from "@/modules/slot"

/** What the route passes: the query the page was opened with. */
interface LeadsPageProps {
    /** `?q=` prefills the search. */
    readonly query: string
    /** `?new=1` opens the new-lead form. */
    readonly openForm: boolean
}

/** The document title of the Leads page. */
export const leadsPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("leads")
    return { title: t("title") }
}

/** The Leads page: every lead of the active workspace with its owner, stage and next action. A failed read reaches the route error boundary. */
export const LeadsPage = async (props: LeadsPageProps) => {
    const session = await getSession()
    const leads = await readLeads(session.workspace.id)
    if (leads.kind !== "ok") throw new Error(`leads: ${leads.kind} ${leads.code}`)
    return (
        <LeadsPageLayout
            heading={<LeadsHeading isFormOpen={props.openForm} />}
            form={props.openForm ? <LeadCreateForm channelKeys={CHANNEL_KEYS} /> : null}
            board={<LeadsBoard leads={toSlot(leads)} nowIso={new Date().toISOString()} initialQuery={props.query} />}
            promo={leads.value.length > 0 ? <LeadsPromoRow /> : null}
        />
    )
}
