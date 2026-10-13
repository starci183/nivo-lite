import { LeadsList } from "@/features/leads-list"
import { listLeads } from "@/lib/queries"
import { readChatbotState } from "@/modules/db/promo/read-chatbot-state"

type LeadsPageProps = { readonly searchParams: Promise<{ q?: string | string[]; new?: string | string[] }> }

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""))

/** Leads list: every lead with its owner, stage and next action. `?q=` prefills search, `?new=1` opens the form. */
const LeadsPage = async ({ searchParams }: LeadsPageProps) => {
    const [leads, params, chatbot] = await Promise.all([listLeads(), searchParams, readChatbotState()])
    return (
        <LeadsList
            leads={leads}
            nowIso={new Date().toISOString()}
            initialQuery={first(params.q)}
            initialFormOpen={first(params.new) === "1"}
            hasChatbot={chatbot.kind !== "ok" || chatbot.value.hasChatbot}
        />
    )
}

export default LeadsPage
