import "server-only"
import { FOUNDING_OFFER, isOfferLive } from "@/lib/promo"
import { getSession } from "@/lib/session"
import { supabaseServer } from "@/lib/supabase/server"

/** Whether this workspace already owns a Chatbot, and how to address it. */
export type ChatbotState = {
  readonly hasChatbot: boolean
  readonly agentId: string | null
  readonly handle: string | null
  readonly name: string | null
}

/** The workspace's chatbot agent (module = chatbot), or an empty state. Real rows only. */
export const getChatbotState = async (): Promise<ChatbotState> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("agents")
    .select("id, handle, name")
    .eq("workspace_id", session.workspace.id)
    .eq("module", "chatbot")
    .order("created_at", { ascending: true })
    .limit(1)
  const row = (data ?? [])[0] as { id: string; handle: string; name: string } | undefined
  return row === undefined
    ? { hasChatbot: false, agentId: null, handle: null, name: null }
    : { hasChatbot: true, agentId: row.id, handle: row.handle, name: row.name }
}

/** True when a `module.purchased` event exists inside the Founding 50 window. */
export const isFoundingMember = async (): Promise<boolean> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("workspace_id", session.workspace.id)
    .eq("kind", "module.purchased")
    .gte("created_at", new Date(FOUNDING_OFFER.startsAt).toISOString())
    .lte("created_at", new Date(FOUNDING_OFFER.endsAt).toISOString())
    .limit(1)
  return isOfferLive() && (data ?? []).length > 0
}

/** What the lead page can honestly say about a website lead. */
export type LeadWait = {
  /** Show the nudge at all: website channel and no chatbot in this workspace. */
  readonly show: boolean
  /** Whole hours between capture and the first approved reply (or now, if none), only when computable. */
  readonly hours: number | null
  readonly replied: boolean
}

const HIDDEN: LeadWait = { show: false, hours: null, replied: false }

/** Wait time of a lead computed from its capture time and its real `execution.approved` events. */
export const getLeadWait = async (leadId: string): Promise<LeadWait> => {
  const session = await getSession()
  const supabase = await supabaseServer()
  const [chatbot, leadRes, eventRes] = await Promise.all([
    getChatbotState(),
    supabase.from("leads").select("channel, created_at").eq("id", leadId).eq("workspace_id", session.workspace.id).maybeSingle(),
    supabase.from("events").select("kind, created_at").eq("lead_id", leadId).eq("kind", "execution.approved").order("created_at", { ascending: true }).limit(1),
  ])
  const lead = leadRes.data as { channel: string; created_at: string } | null
  if (chatbot.hasChatbot || lead === null || !/website/i.test(lead.channel)) return HIDDEN
  const captured = Date.parse(lead.created_at)
  const reply = ((eventRes.data ?? [])[0] as { created_at: string } | undefined)?.created_at
  const end = reply !== undefined ? Date.parse(reply) : Date.now()
  const hours = Math.floor((end - captured) / 3_600_000)
  return { show: true, hours: Number.isFinite(hours) && hours >= 1 ? hours : null, replied: reply !== undefined }
}
