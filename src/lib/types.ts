export type Workspace = { id: string; owner_id: string; name: string; created_at: string };
export type ModuleKey = "chatbot" | "sales" | "accounting";
export type Agent = {
  id: string; workspace_id: string; module: ModuleKey; name: string; handle: string; role: string; instructions: string;
  knowledge: string; greeting: string; approval_rule: string; status: "active" | "paused"; created_at: string;
};
export type AgentConversation = {
  id: string; workspace_id: string; agent_id: string; kind: "test" | "customer"; visitor_name: string | null;
  lead_id: string | null; created_at: string;
  /** set while a person has taken over a customer conversation (the AI stays quiet) */
  handled_by?: string | null; handled_at?: string | null;
  /** where the customer is: "website" (the page itself) or a real channel such as "telegram" with its chat id */
  channel?: string | null; external_id?: string | null;
};
export type AgentMessage = {
  id: string; workspace_id: string; conversation_id: string; role: "user" | "agent" | "system"; body: string; created_at: string;
};
export type LeadStage = "new" | "qualified" | "proposal" | "won" | "lost";
export type Lead = {
  id: string; workspace_id: string; contact_name: string; company: string; channel: string; need: string;
  stage: LeadStage; context_summary: string | null; created_at: string;
  phone?: string | null; email?: string | null; /** null = legacy/seed (unlabelled) */ origin?: "live" | "simulated" | null;
};
export type ResponsibilityStatus = "open" | "waiting_approval" | "done";
export type Responsibility = {
  id: string; workspace_id: string; lead_id: string; title: string; owner_kind: "human" | "agent";
  owner_agent_id: string | null; owner_name: string; next_action: string; due_at: string | null;
  status: ResponsibilityStatus; created_at: string;
};
export type ExecutionStatus = "pending_approval" | "approved" | "rejected";
export type Execution = {
  id: string; workspace_id: string; responsibility_id: string; agent_id: string | null; kind: string; draft: string;
  status: ExecutionStatus; decided_by: string | null; decided_at: string | null; created_at: string;
  work_item_id?: string | null;
  /** the staff member the message was written as (Office "Nhắn với tư cách"), null for the owner */
  staff_id?: string | null;
};
export type Message = {
  id: string; workspace_id: string; author_kind: "human" | "agent" | "system"; author_name: string;
  agent_id: string | null; body: string; lead_id: string | null; created_at: string;
  work_item_id?: string | null;
};
export type EventRow = {
  id: string; workspace_id: string; lead_id: string | null; kind: string; actor: string; summary: string;
  evidence: string | null; created_at: string;
};

/** A server action result: never throws to the UI. */
export type Outcome<T> = { ok: true; data: T } | { ok: false; error: string };

export type ResponsibilityWithLead = Responsibility & { lead: Pick<Lead, "id" | "contact_name" | "company" | "stage"> };
export type LeadDetail = {
  lead: Lead;
  responsibilities: Responsibility[];
  executions: Execution[];
  events: EventRow[];
  agents: Agent[];
};
