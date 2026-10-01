/** NIVO operating flow: the shared contract (FLOW-PLAN §e). Pure types; other lanes compile against this file. */
export type Department = "chatbot" | "sales" | "accounting";
export type FlowAction = "reply_customer" | "handoff_lead" | "classify_lead" | "send_follow_up" | "send_quote"
  | "confirm_order" | "send_care" | "issue_invoice" | "reconcile_payment" | "send_email";
export type RuleMode = "auto" | "ask" | "never";
export type ReasonCode = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed";
export type WorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed";
export type EvidenceState = "pending" | "captured" | "reviewed" | "verified" | "customer_confirmed";
export type Origin = "live" | "simulated";
export type InboundChannel = "website" | "telegram" | "facebook" | "zalo" | "email" | "phone" | "bank" | "manual";
export type InboundKind = "message" | "lead" | "order" | "invoice" | "payment";

export type Authority = { workspace_id: string; goal_revenue_vnd: number | null; goal_new_customers: number | null;
  goal_first_reply_minutes: number | null; goal_note: string; policies: string; reply_style: string; brand_voice: string;
  limits_note: string; updated_by: string | null; updated_at: string };
export type AuthorityRule = { id: string; workspace_id: string; department: Department; action: FlowAction; mode: RuleMode;
  limit_vnd: number | null; required_fields: string[]; note: string; updated_at: string };
export type Staff = { id: string; workspace_id: string; name: string; role: string; email: string | null; active: boolean; created_at: string };
export type InboundEvent = { id: string; workspace_id: string; channel: InboundChannel; kind: InboundKind; origin: Origin;
  sender_name: string | null; sender_contact: string | null; body: string; amount_vnd: number | null; external_ref: string | null;
  dedupe_key: string; duplicate_count: number; last_duplicate_at: string | null; lead_id: string | null;
  status: "received" | "processed" | "needs_decision" | "failed"; created_at: string;
  /** the channel's own event id (Telegram `tg:<chat>:<msg>`, bank connection `vietcombank:<id>`), null for legacy rows */
  event_id?: string | null };
export type Order = { id: string; workspace_id: string; lead_id: string | null; order_no: string; items: string; amount_vnd: number | null;
  status: "draft" | "confirmed" | "invoiced" | "paid" | "cancelled"; origin: Origin; confirmed_by: string | null; confirmed_at: string | null; created_at: string };
export type Invoice = { id: string; workspace_id: string; order_id: string | null; lead_id: string | null; invoice_no: string; amount_vnd: number;
  due_at: string | null; status: "draft" | "issued" | "paid" | "void"; origin: Origin; issued_by: string | null; issued_at: string | null; paid_at: string | null; created_at: string };
export type Transaction = { id: string; workspace_id: string; channel: "bank" | "cash" | "card" | "ewallet"; amount_vnd: number; reference: string | null;
  payer: string | null; occurred_at: string; invoice_id: string | null; status: "unmatched" | "matched" | "needs_review"; origin: Origin; created_at: string };
export type Proposal = { summary: string; draft?: string; amount_vnd?: number | null;
  fields: Record<string, string | number | null>; confidence?: number; outcome?: "clear" | "unclear";
  candidates?: Array<{ id: string; label: string; amount_vnd: number }> };
export type WorkItem = { id: string; workspace_id: string; department: Department; action: FlowAction;
  subject_type: "lead" | "order" | "invoice" | "transaction" | "conversation" | "inbound"; subject_id: string | null;
  lead_id: string | null; inbound_event_id: string | null; parent_id: string | null; status: WorkStatus;
  decided_path: "auto" | "human" | null; reason: ReasonCode | null; reasons: string[]; missing_fields: string[];
  proposal: Proposal; result: { summary: string; href?: string } | null; error: string | null; evidence_state: EvidenceState;
  assigned_staff_id: string | null; execution_id: string | null; origin: Origin; created_at: string; updated_at: string; completed_at: string | null };
export type WorkItemView = WorkItem & {
  lead: { id: string; contact_name: string; company: string; channel: string } | null;
  assignedStaffName: string | null;
  /** true when a legacy execution approval card already renders this item (Office must not render it twice) */
  hasApprovalCard: boolean;
  href: string };
export type DecisionRow = { id: string; work_item_id: string | null; lead_id: string | null; leadName: string | null;
  department: Department; action: FlowAction; decided_by: string; decider_kind: "policy" | "owner" | "staff";
  outcome: "auto_done" | "approved" | "edited" | "rejected"; reason: ReasonCode | null; note: string | null; created_at: string };
export type GateInput = { department: Department; action: FlowAction; rule: AuthorityRule | null; proposal: Proposal;
  humanApproved?: boolean; priorApproval?: { amount_vnd: number | null } };
export type GateVerdict = { verdict: "auto" | "ask"; reason: ReasonCode; reasons: ReasonCode[]; missing: string[] };
export type WorkEdits = { draft?: string; amount_vnd?: number | null; fields?: Record<string, string | number | null>; candidateId?: string };
export type Governance = {
  goals: { revenueVnd: number | null; newCustomers: number | null; firstReplyMinutes: number | null };
  results: { confirmedVnd: number; invoicedVnd: number; collectedVnd: number; ordersConfirmed: number;
    newCustomers7d: number; wonCustomers: number; simulated: number; total: number };
  efficiency: { autoDone7d: number; askedHuman7d: number; medianDecisionMinutes: number | null };
  pendingDecisions: number; // waiting work_items + pending executions with no work_item_id (counted once)
  exceptions: Record<ReasonCode | "failed", number>;
  departments: Array<{ department: Department; done7d: number; waiting: number; lastActivityAt: string | null }>;
  recentDecisions: DecisionRow[] };
export type SimulateInboundInput = { channel: Exclude<InboundChannel, "website">; kind: InboundKind; sender_name: string;
  sender_contact?: string; body?: string; amount_vnd?: number | null; external_ref?: string; items?: string;
  /** Channel event id (idempotency): the same event redelivered is stored once. */
  event_id?: string };
export type LeadFlow = { workItems: WorkItemView[]; orders: Order[]; invoices: Invoice[]; transactions: Transaction[]; decisions: DecisionRow[] };
