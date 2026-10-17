import { builder } from "@starci/jest-preset"
import type { BoundAgent } from "@modules/domain/agent-connections"
import type { AgentProfile } from "@modules/domain/agents"
import type { WorkContext } from "@modules/domain/decisions"
import type { MetaInboundJob } from "@modules/domain/meta-inbox"
import type { MetaEvent, MetaPageAccess } from "@modules/integrations/meta"
import { EMPTY_SIGNALS } from "@modules/domain/lead-flows"
import type { LeadFlow } from "@modules/domain/lead-flows"

export const AT_ISO = "2026-10-12T10:00:00.000Z"

export const AT = Date.parse(AT_ISO)

export const PAGE: MetaPageAccess = { pageId: "page-1", pageToken: "page-token", igId: null }

export const ctx: WorkContext = { workspaceId: "ws-1", actor: "Facebook", locale: "vi" }

export const PROFILE: AgentProfile = {
    id: "agent-1",
    name: "Linh",
    handle: "linh",
    role: "Lead gen",
    instructions: "",
    knowledge: "",
    approval_rule: "",
}

export const eventOf = builder<MetaEvent>({
    kind: "dm",
    platform: "facebook",
    page_id: "page-1",
    ig_id: null,
    sender_psid: "person-1",
    sender_igsid: null,
    sender_name: "Lan",
    text: " Hello ",
    comment_id: null,
    post_id: null,
    leadgen_id: null,
    form_id: null,
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: "mid-1",
    timestamp: AT,
    event_key: "dm:mid-1",
})

export const agentOf = builder<BoundAgent>({
    id: "agent-1",
    module: "lead_gen",
    name: "Linh",
    access: "auto",
    purpose: "lead_source",
})

export const flowOf = builder<LeadFlow>({
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: "conv-1",
    platform: "facebook",
    psid: "person-1",
    igsid: null,
    phone: null,
    email: null,
    name: "Lan",
    state: "nurturing",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 1,
    pending_question: null,
    contact_asked_at: null,
    signals: EMPTY_SIGNALS,
    score: "warm",
    score_reasons: [],
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: AT_ISO,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
})

/** Wraps a Meta event with the workspace and connection receipt context. */
export const jobOf = (event: MetaEvent = eventOf()): MetaInboundJob => ({
    connectionId: "connection-1",
    workspaceId: "ws-1",
    event,
})
