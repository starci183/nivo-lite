import "server-only";
import { logEvidence } from "./core";
import { resolveBotToken, type Connection } from "./channels";
import { telegramSend } from "./telegram";
import { isNegativeFeedback } from "./automation-ai";
import { minutesToHhmm, vnClock } from "./automation-hours";
import { runSheetOrdersEvent } from "./google";
import { composeAndSend, customerConversation, loadLead, postOffice, str, vndText, type Executor, type RunCtx, type StepEx } from "./automation-runs";
import type { AutomationRunStatus } from "./automation-shared";

/**
 * The executors of the implemented templates. Each gets the run context and the payload its trigger carried, does ONE thing and reports steps + evidence.
 * Anything that reaches a customer goes through composeAndSend (the authority gate). An exception makes the run "failed" and is retried with backoff.
 */
const noChannel = (name: string): { status: AutomationRunStatus; steps: Array<StepEx> } => ({
  status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: `${name} chưa có cuộc trò chuyện nào để NIVO nhắn lại.` }],
});

/** Template 1: thank the customer when a payment is matched. */
export const thankPayment: Executor = async (x, p) => {
  const leadId = str(p.lead_id);
  const amount = Number(p.amount_vnd) || 0;
  const min = Number(x.config.minAmount) || 0;
  if (amount < min) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: `Số tiền ${vndText(amount)} nhỏ hơn mức bạn đặt (${vndText(min)}).` }] };
  const lead = leadId ? await loadLead(x.db, x.ws, leadId) : null;
  if (!lead) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Khoản tiền này chưa gắn với khách nào." }] };
  const conv = await customerConversation(x.db, x.ws, lead.id);
  if (!conv) return noChannel(lead.contact_name);
  return composeAndSend(x, {
    action: "send_care", lead, conversationId: conv.id, dedupe: `thank:${str(p.invoice_id) || leadId}`,
    summary: `Cảm ơn ${lead.contact_name} đã thanh toán ${vndText(amount)}`, caseNote: `Khách vừa thanh toán ${vndText(amount)}.`,
    vars: { ten_khach: lead.contact_name, so_tien: vndText(amount), ma_phieu: str(p.invoice_no) },
  });
};

/** Template 4: ask for feedback some days after payment (the run was scheduled when the payment arrived). */
export const askReview: Executor = async (x, p) => {
  const lead = str(p.lead_id) ? await loadLead(x.db, x.ws, str(p.lead_id)) : null;
  if (!lead) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Không tìm thấy khách." }] };
  const conv = await customerConversation(x.db, x.ws, lead.id);
  if (!conv) return noChannel(lead.contact_name);
  return composeAndSend(x, {
    action: "send_care", lead, conversationId: conv.id, dedupe: `review:${str(p.invoice_id) || lead.id}`,
    summary: `Xin nhận xét từ ${lead.contact_name}`, caseNote: "Khách đã thanh toán vài ngày trước.",
    vars: { ten_khach: lead.contact_name, so_tien: vndText(Number(p.amount_vnd) || 0), ma_phieu: str(p.invoice_no) },
  });
};

/** Template 2: a gentle nudge to a customer who has neither bought nor declined. */
export const nurtureLead: Executor = async (x, p) => {
  const lead = await loadLead(x.db, x.ws, str(p.lead_id));
  if (!lead || ["won", "lost"].includes(lead.stage)) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Khách đã chốt hoặc đã từ chối." }] };
  const conv = await customerConversation(x.db, x.ws, lead.id);
  if (!conv) return noChannel(lead.contact_name);
  return composeAndSend(x, {
    action: "send_follow_up", lead, conversationId: conv.id, dedupe: str(p.dedupe) || `nurture:${lead.id}:${str(p.k)}`,
    summary: `Nhắn lại lần ${str(p.k)} cho ${lead.contact_name}`, caseNote: `Khách hỏi về "${lead.need}" và chưa quyết định; đây là lần nhắn lại thứ ${str(p.k)}.`,
    vars: { ten_khach: lead.contact_name, nhu_cau: lead.need },
  });
};

/** Template 6: invite a past customer back; ALWAYS waits for the owner. */
export const winBack: Executor = async (x, p) => {
  const lead = await loadLead(x.db, x.ws, str(p.lead_id));
  if (!lead || lead.stage === "lost") return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Khách không còn trong danh sách chăm sóc." }] };
  const conv = await customerConversation(x.db, x.ws, lead.id);
  if (!conv) return noChannel(lead.contact_name);
  const offer = str(x.config.offer);
  return composeAndSend(x, {
    action: "send_follow_up", forceAsk: true, lead, conversationId: conv.id, dedupe: str(p.dedupe),
    summary: `Mời ${lead.contact_name} quay lại${offer ? ` (${offer})` : ""}`, caseNote: `Khách lâu không có hoạt động; ưu đãi: ${offer || "không có"}.`,
    vars: { ten_khach: lead.contact_name, nhu_cau: lead.need, uu_dai: offer },
  });
};

/** Template 5: a polite reminder for an overdue payment; the second reminder also tells the owner. */
export const debtReminder: Executor = async (x, p) => {
  const lead = await loadLead(x.db, x.ws, str(p.lead_id));
  if (!lead) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Phiếu này chưa gắn với khách nào." }] };
  const k = Number(p.k) || 1;
  const conv = await customerConversation(x.db, x.ws, lead.id);
  const steps: Array<StepEx> = [];
  if (k >= 2) {
    await postOffice(x.db, x.ws, `Nhắc lần ${k}: ${lead.contact_name} vẫn chưa thanh toán ${vndText(Number(p.amount_vnd) || 0)} (mã ${str(p.invoice_no)}). Bạn xem có cần gọi cho khách không.`, lead.id);
    await logEvidence(x.db, x.ws, { lead_id: lead.id, kind: "automation.owner_notified", actor: "Tự động hoá · Nhắc công nợ", summary: `Báo chủ shop: lần nhắc thứ ${k} cho ${lead.contact_name}`, evidence: str(p.invoice_no) });
    steps.push({ label: "Đã báo bạn trong Văn phòng", status: "done", detail: `Lần nhắc thứ ${k}` });
  }
  if (!conv) return { status: steps.length ? "done" : "skipped", steps: [...steps, { label: "Bỏ qua", status: "skipped", detail: `${lead.contact_name} chưa có cuộc trò chuyện để nhắn.` }] };
  const sent = await composeAndSend(x, {
    action: "send_care", lead, conversationId: conv.id, dedupe: str(p.dedupe),
    summary: `Nhắc khoản ${vndText(Number(p.amount_vnd) || 0)} của ${lead.contact_name}`, caseNote: `Khoản ${str(p.invoice_no)} quá hạn; đây là lần nhắc thứ ${k}.`,
    vars: { ten_khach: lead.contact_name, so_tien: vndText(Number(p.amount_vnd) || 0), ma_phieu: str(p.invoice_no) },
  });
  return { ...sent, steps: [...steps, ...sent.steps] };
};

/** Template 7: a customer wrote outside opening hours: say a person will call back and give staff a call task. Runs after the chat reply (event level hook). */
export const afterHours: Executor = async (x, p) => {
  const convId = str(p.conversation_id);
  const conv = (await x.db.from("agent_conversations").select("id, visitor_name, lead_id, handled_by, channel").eq("workspace_id", x.ws).eq("id", convId).maybeSingle()).data as
    { id: string; visitor_name: string | null; lead_id: string | null; handled_by: string | null; channel: string | null } | null;
  if (!conv) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Không tìm thấy cuộc trò chuyện." }] };
  if (conv.handled_by) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Một người đang trực tiếp trả lời khách này." }] };
  const leadId = str(p.lead_id) || conv.lead_id || "";
  const lead = leadId ? await loadLead(x.db, x.ws, leadId) : null;
  const name = lead?.contact_name ?? conv.visitor_name ?? "Khách";
  // The conversation may have no lead yet (the customer has not shared contact details): the gate still needs a customer record to speak to.
  const speaker = lead ?? { id: "", workspace_id: x.ws, contact_name: name, company: "", channel: conv.channel ?? "website", need: "", stage: "new" as const, context_summary: null, created_at: new Date().toISOString(), phone: null, email: null, origin: "live" as const };
  const steps: Array<StepEx> = [];
  const res = lead
    ? await composeAndSend(x, {
      action: "reply_customer", lead, conversationId: conv.id, dedupe: str(p.dedupe), summary: `Báo ${name} sẽ có người gọi lại sáng mai`,
      caseNote: "Khách nhắn ngoài giờ mở cửa.", vars: { ten_khach: name },
    })
    : await sendWithoutLead(x, conv.id, speaker.contact_name, str(p.dedupe));
  steps.push(...res.steps);
  // A task for staff: call the customer back tomorrow morning (Vietnam time), and a line in Office.
  const due = new Date(Date.now() + 86_400_000);
  due.setUTCHours(2, 0, 0, 0); // 09:00 Vietnam time
  if (lead) {
    const staff = ((await x.db.from("staff").select("id, name").eq("workspace_id", x.ws).eq("active", true).order("created_at").limit(1)).data ?? [])[0] as { id: string; name: string } | undefined;
    await x.db.from("responsibilities").insert({
      workspace_id: x.ws, lead_id: lead.id, title: `Gọi lại cho ${name} (nhắn ngoài giờ)`, owner_kind: "human", owner_name: staff?.name ?? "Nhân viên",
      next_action: `Gọi lại cho ${name}${lead.phone ? ` (${lead.phone})` : ""} vào sáng mai và trả lời câu hỏi khách đã nhắn.`, due_at: due.toISOString(),
    });
    steps.push({ label: "Đã tạo việc gọi lại cho nhân viên", status: "done", detail: `${staff?.name ?? "Nhân viên"} · trước 9:00 sáng mai` });
  }
  await postOffice(x.db, x.ws, `${name} nhắn ngoài giờ: «${str(p.text).slice(0, 160)}». Cần gọi lại vào sáng mai.`, lead?.id ?? null);
  steps.push({ label: "Đã báo trong Văn phòng", status: "done" });
  return { status: res.status, steps, evidence: res.evidence ?? null };
};

/** No lead yet: the reply is still a gated work item on the conversation (the gate only needs the conversation). */
const sendWithoutLead = async (x: RunCtx, conversationId: string, name: string, dedupe: string) => {
  const { engineCtxFor } = await import("./automation-runs");
  const { runWork } = await import("./engine");
  const { fillBody } = await import("./automation-shared");
  const text = fillBody(x.body, { ten_shop: x.shop.shop, gio_mo_cua: x.shop.hours, ten_khach: name });
  const item = await runWork(engineCtxFor(x), {
    action: "reply_customer", subject_type: "conversation", subject_id: conversationId, origin: "live", dedupeKey: `automation:${x.pipeline.id}:${dedupe}`, preset: true, noChain: true,
    seed: { summary: `Báo ${name} sẽ có người gọi lại sáng mai`, draft: text, fields: { conversation_id: conversationId, question: "" } },
  });
  const stepBase = { workItemId: item.id, message: text } as const;
  if (item.status === "done") return { status: "done" as const, steps: [{ ...stepBase, label: "Đã gửi cho khách", status: "done" as const, detail: item.result?.summary }], evidence: item.result?.summary ?? null };
  if (item.status === "waiting_decision") return { status: "waiting_approval" as const, steps: [{ ...stepBase, label: "Chờ bạn duyệt", status: "waiting" as const }], evidence: "Đang chờ quyết định trong Văn phòng" };
  throw new Error(item.error ?? "Không gửi được tin cho khách.");
};

/** Template 3: the end-of-day report, posted to Office (and to the owner's Telegram chat when one is registered on a Telegram connection). */
export const dailyReport: Executor = async (x, p) => {
  const day = str(p.day) || vnClock().day;
  const start = new Date(`${day}T00:00:00+07:00`).toISOString();
  const db = x.db;
  const [leads, orders, paid, waiting, outcomes] = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", x.ws).gte("created_at", start),
    db.from("orders").select("amount_vnd").eq("workspace_id", x.ws).gte("confirmed_at", start).neq("status", "cancelled"),
    db.from("invoices").select("amount_vnd").eq("workspace_id", x.ws).eq("status", "paid").gte("paid_at", start),
    db.from("work_items").select("proposal, department").eq("workspace_id", x.ws).eq("status", "waiting_decision").order("created_at").limit(50),
    db.from("events").select("lead_id").eq("workspace_id", x.ws).eq("kind", "outcome.recorded").gte("created_at", start),
  ]);
  const confirmed = (orders.data ?? []) as Array<{ amount_vnd: number | null }>;
  const money = ((paid.data ?? []) as Array<{ amount_vnd: number }>).reduce((s, r) => s + Number(r.amount_vnd), 0);
  const wonLeadIds = [...new Set(((outcomes.data ?? []) as Array<{ lead_id: string | null }>).map((o) => o.lead_id).filter((v): v is string => Boolean(v)))];
  const won = wonLeadIds.length ? ((await db.from("leads").select("id", { count: "exact", head: true }).in("id", wonLeadIds).eq("stage", "won")).count ?? 0) : 0;
  const waits = (waiting.data ?? []) as Array<{ proposal: { summary?: string } }>;
  const dealsWon = Math.max(won, confirmed.length);
  const lines = [
    `Báo cáo ngày ${day.split("-").reverse().join("/")} · ${x.shop.shop}`,
    `• Khách mới: ${leads.count ?? 0}`,
    `• Đơn chốt: ${dealsWon}${confirmed.length ? ` (tổng ${vndText(confirmed.reduce((s, r) => s + Number(r.amount_vnd ?? 0), 0))})` : ""}`,
    `• Tiền về: ${vndText(money)}`,
    waits.length ? `• Việc đang chờ bạn quyết: ${waits.length}${waits.slice(0, 3).map((w) => `\n   - ${(w.proposal?.summary ?? "").slice(0, 90)}`).join("")}` : "• Việc đang chờ bạn quyết: không có",
  ];
  const text = lines.join("\n");
  await postOffice(db, x.ws, text);
  const steps: Array<StepEx> = [{ label: "Đã đăng báo cáo trong Văn phòng", status: "done", message: text }];
  if (x.config.toOwnerChat === true) {
    const sent = await sendToOwnerTelegram(x, text);
    steps.push(sent ? { label: "Đã gửi cho chủ shop qua Telegram", status: "done" } : { label: "Chưa gửi qua Telegram", status: "skipped", detail: "Chưa có kết nối Telegram với mã trò chuyện của chủ shop." });
  }
  return { status: "done", steps, evidence: `Khách mới ${leads.count ?? 0} · đơn chốt ${dealsWon} · tiền về ${vndText(money)} · chờ quyết ${waits.length}` };
};

/** The owner's own Telegram chat: only when a Telegram connection records it (public_meta.owner_chat_id). Never guessed. */
const sendToOwnerTelegram = async (x: RunCtx, text: string): Promise<boolean> => {
  const { data } = await x.db.from("connections").select("id, public_meta").eq("workspace_id", x.ws).eq("provider", "telegram").eq("status", "connected");
  for (const c of (data ?? []) as Array<{ id: string; public_meta: Connection["meta"] | null }>) {
    const chatId = c.public_meta?.owner_chat_id;
    if (!chatId) continue;
    const token = await resolveBotToken(x.ws, c.id);
    if (!token) continue;
    try {
      await telegramSend(token, chatId, text);
      return true;
    } catch (e) {
      console.error("daily report telegram failed:", e instanceof Error ? e.message : e);
    }
  }
  return false;
};

/** Template 8: the Google Sheet row (the Google lane's runSheetOrdersEvent does the API work). */
export const sheetOrders: Executor = async (x, p) => {
  const out = await runSheetOrdersEvent(x.ws, x.config, { event: str(p.event) as "order.confirmed", data: (p.data ?? {}) as Record<string, unknown>, occurredAt: str(p.at) });
  return out.skipped
    ? { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Bạn đã tắt ghi loại sự kiện này." }], evidence: out.evidence }
    : { status: "done", steps: [{ label: "Đã ghi vào Google Sheet", status: "done", detail: out.evidence }], evidence: out.evidence };
};

/** After a review request, a customer's next message is read for feedback: a negative one tags the owner in Office. Returns true when it raised an alert. */
export const checkFeedback = async (x: RunCtx, run: { id: string; payload: Record<string, unknown> }, text: string, leadId: string): Promise<boolean> => {
  const negative = await isNegativeFeedback(text, x.ws);
  await x.db.from("automation_runs").update({ payload: { ...run.payload, feedback: { negative, text: text.slice(0, 300), at: new Date().toISOString() } } }).eq("id", run.id);
  if (!negative) return false;
  const lead = await loadLead(x.db, x.ws, leadId);
  const name = lead?.contact_name ?? "Khách";
  await postOffice(x.db, x.ws, `@chủ shop: ${name} phản hồi chưa hài lòng sau khi dùng dịch vụ: «${text.slice(0, 200)}». Bạn xem lại và liên hệ giúp nhé.`, leadId);
  await logEvidence(x.db, x.ws, { lead_id: leadId, kind: "automation.negative_review", actor: "Tự động hoá · Xin đánh giá", summary: `Phản hồi chưa tốt từ ${name}`, evidence: text.slice(0, 300) });
  return true;
};

export const hoursLabel = (range: { from: number; to: number } | null, fallback: string): string => (range ? `${minutesToHhmm(range.from)} - ${minutesToHhmm(range.to)}` : fallback);
