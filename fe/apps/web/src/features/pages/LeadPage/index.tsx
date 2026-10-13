import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { LeadContext } from "@/components/blocks/LeadContext"
import { LeadExecution } from "@/components/blocks/LeadExecution"
import { LeadHeader } from "@/components/blocks/LeadHeader"
import { LeadHistory } from "@/components/blocks/LeadHistory"
import { LeadOutcome } from "@/components/blocks/LeadOutcome"
import { LeadPreviousSteps } from "@/components/blocks/LeadPreviousSteps"
import { LeadResponsibility } from "@/components/blocks/LeadResponsibility"
import { LeadWorkFlow } from "@/components/blocks/LeadWorkFlow"
import { LeadPageLayout } from "@/components/composites/LeadPageLayout"
import { PromoLeadWaitNote } from "@/features/pages/PromoLeadWaitNote"
import { getSession } from "@/lib/session"
import { channelLabelOf, readLead, readLeadFlow } from "@/modules/db"
import type { ChannelLabels } from "@/modules/db"
import { toSlot } from "@/modules/slot"

/** What the route passes: the lead the address names. */
interface LeadPageProps {
    readonly leadId: string
}

/** The channel labels a translator of the leads catalog gives. */
const wordsOf = (t: (key: string) => string): ChannelLabels => ({
    channelZalo: t("channelZalo"),
    channelWebsiteChat: t("channelWebsiteChat"),
    channelWebsiteForm: t("channelWebsiteForm"),
    channelPhone: t("channelPhone"),
    channelEmail: t("channelEmail"),
    channelReferral: t("channelReferral"),
})

/** The document title of the lead page. */
export const leadPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("leads")
    return { title: t("detailEyebrow") }
}

/** The lead journey page: context, responsibility, execution, outcome and history. A missing lead is not-found; a failed read reaches the route error boundary. */
export const LeadPage = async (props: LeadPageProps) => {
    const session = await getSession()
    const workspaceId = session.workspace.id
    const [detail, flow, reader, vi, en] = await Promise.all([
        readLead(workspaceId, props.leadId),
        readLeadFlow(props.leadId),
        getTranslations("leads").then(wordsOf),
        getTranslations({ locale: "vi", namespace: "leads" }).then(wordsOf),
        getTranslations({ locale: "en", namespace: "leads" }).then(wordsOf),
    ])
    if (detail.kind === "not-found") notFound()
    if (detail.kind !== "ok") throw new Error(`lead: ${detail.kind} ${detail.code}`)
    const channelLabel = channelLabelOf(detail.value.lead.channel, [vi, en], reader)
    return (
        <LeadPageLayout
            header={<LeadHeader detail={detail.value} channelLabel={channelLabel} />}
            primary={
                <>
                    <LeadExecution detail={detail.value} />
                    <LeadWorkFlow flow={toSlot(flow)} />
                    <LeadHistory detail={detail.value} />
                    <PromoLeadWaitNote leadId={detail.value.lead.id} />
                </>
            }
            rail={
                <>
                    <LeadResponsibility detail={detail.value} workspaceId={workspaceId} />
                    <LeadPreviousSteps detail={detail.value} />
                    <LeadContext detail={detail.value} channelLabel={channelLabel} />
                    <LeadOutcome detail={detail.value} workspaceId={workspaceId} />
                </>
            }
        />
    )
}
