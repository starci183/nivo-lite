import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFlowDefaults } from "./flow-seed";

type Locale = "vi" | "en";

const days = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

type LeadSeed = {
  key: string; contact_name: string; company: string; channel: string; need: string;
  stage: "new" | "qualified" | "proposal" | "won" | "lost"; minutesAgo: number; context: string | null;
};

type AgentCopy = { role: string; instructions: string; knowledge: string; approval: string };
type Keyed = { bookA: string; proposalC: string; confirmF: string; kickoffD: string; discoveryD: string; invoiceD: string; qualifyE: string };

/** Every piece of demo copy that is shown to the reader, per language. */
type Copy = {
  leads: LeadSeed[];
  salesAgent: AgentCopy;
  accAgent: AgentCopy;
  ch: { zalo: string; zaloInbox: string; form: string; referral: string; phone: string };
  titles: Keyed;
  next: Keyed;
  draftA: string;
  draftD: string;
  ev: {
    salesIncluded: string; accIncluded: string; capturedFrom: (ch: string) => string; owner: (who: string, next: string) => string;
    lostEvidence: string; contextBrief: string; approvedSent: (name: string, ch: string) => string; approvedEvidence: string;
    stageLost: string; stageWon: string; stageProposal: string; wonEvidence: string; handed: (next: string) => string;
    formEvidence: string; proposalEvidence: string; drafted: (next: string) => string;
  };
  msg: {
    newLeadNoOwner: (name: string, ch: string) => string; newLeadOwnerTaken: (name: string, ch: string) => string;
    newLeadAssigned: (name: string, ch: string) => string;
    cTaken: string; aReady: string; dWon: string; askWaiting: string; answerWaiting: string; chatbotNeed: string; accNext: string;
  };
};

const EN: Copy = {
  leads: [
    {
      key: "a", contact_name: "Customer A", company: "B2B Service Co. (anonymised)", channel: "Zalo", stage: "qualified", minutesAgo: 190,
      need: "Their 6-person sales team loses track of follow-ups after the first call; wants every lead to have a clear owner and next step.",
      context: "- Founder-led B2B service company, 6 sales staff\n- Pain: follow-ups dropped after the first call, no single owner per lead\n- Urgency: high — preparing a Q4 campaign\n- Risk: team already uses spreadsheets; adoption effort needed",
    },
    {
      key: "b", contact_name: "Customer B", company: "Training Academy (anonymised)", channel: "Website form", stage: "new", minutesAgo: 25,
      need: "Asked how AI can answer student enquiries while staff keep control of what is promised.", context: null,
    },
    {
      key: "c", contact_name: "Customer C", company: "Dental Clinic Group (anonymised)", channel: "Website form", stage: "proposal", minutesAgo: 60 * 26,
      need: "Three clinics answer booking questions by phone; wants the chatbot to capture appointment requests and hand them to the front desk.",
      context: "- Three-branch clinic group, front desk overloaded at peak hours\n- Need: capture booking requests 24/7, humans confirm the slot\n- Decision maker: operations manager; budget approved for Q4\n- Risk: patient data must stay inside the clinic's process",
    },
    {
      key: "d", contact_name: "Customer D", company: "Logistics SME (anonymised)", channel: "Referral", stage: "won", minutesAgo: 60 * 72,
      need: "Customer care team misses delivery complaints across Zalo and email.",
      context: "- 20-person logistics company, complaints arrive on Zalo and email\n- Need: one owner per complaint and a visible next action\n- Outcome: pilot agreed after the discovery call",
    },
    {
      key: "e", contact_name: "Customer E", company: "Interior Design Studio (anonymised)", channel: "Phone", stage: "lost", minutesAgo: 60 * 96,
      need: "Wanted a full CRM migration this month.",
      context: "- Small studio, 4 staff\n- Asked for a full CRM migration within two weeks\n- Not a fit for the current scope; revisit in Q1",
    },
    {
      key: "f", contact_name: "Customer F", company: "F&B Chain (anonymised)", channel: "Zalo", stage: "qualified", minutesAgo: 60 * 5,
      need: "Franchise manager wants each store's customer feedback followed up within 24 hours.",
      context: "- 8-store F&B chain, feedback arrives via Zalo OA\n- Need: 24-hour follow-up with a named owner per store\n- Urgency: medium — review scores dropping this quarter",
    },
  ],
  salesAgent: {
    role: "Lead follow-up & proposals",
    instructions: "Own every new lead until a human takes over. Summarise the customer's need, propose the next step and draft follow-up messages. Never send prices, discounts or commitments without the owner's approval.",
    knowledge: "We help founder-led service businesses run sales and customer care with AI agents under human control. Onboarding takes about two weeks. Pricing is confirmed by a team member after a short discovery call.",
    approval: "Every message to a customer needs the owner's approval before it is sent.",
  },
  accAgent: {
    role: "Invoices & receivables",
    instructions: "When a deal is won, prepare the invoice draft from the agreed scope. Track what customers owe and remind the owner before due dates. Never issue an invoice or change an amount without the owner's approval.",
    knowledge: "Invoices are issued in VND. Payment terms are 15 days unless the proposal says otherwise.",
    approval: "Invoices and payment reminders need the owner's approval.",
  },
  ch: { zalo: "Zalo", zaloInbox: "Zalo inbox", form: "Website form", referral: "Referral", phone: "Phone" },
  titles: {
    bookA: "Book discovery call with Customer A", proposalC: "Send pilot proposal to Customer C", confirmF: "Confirm feedback workflow with Customer F",
    kickoffD: "Kick off pilot with Customer D", discoveryD: "Discovery call with Customer D", invoiceD: "Prepare pilot invoice for Customer D", qualifyE: "Qualify Customer E",
  },
  next: {
    bookA: "Send a Zalo message proposing two 30-minute slots this week", proposalC: "Review the 3-clinic pilot scope and send the proposal",
    confirmF: "Ask the franchise manager which 2 stores start the pilot", kickoffD: "Schedule onboarding session with the care team lead",
    discoveryD: "Propose call slots", invoiceD: "Draft the pilot invoice from the signed pilot scope", qualifyE: "Explain current scope and timeline",
  },
  draftA: "Hello, I'm NIVO's sales assistant. Thank you for sharing that your sales team loses follow-ups after the first call. We'd like to propose a 30-minute session to understand your current process: Thursday 10:00 or Friday 15:00 this week. Please let me know which slot suits you.",
  draftD: "Hello, thank you for being referred to NIVO. We'd like to propose a 30-minute session on Tuesday at 14:00 to look at how your customer care team currently handles delivery complaints.",
  ev: {
    salesIncluded: "Sales module included with the workspace", accIncluded: "Accounting module included with the workspace",
    capturedFrom: (ch) => `Lead captured from ${ch}`, owner: (who, next) => `Owner: ${who} · Next action: ${next}`,
    lostEvidence: "Customer needs a full CRM migration within two weeks; outside current scope. Revisit in Q1.",
    contextBrief: "Context brief created", approvedSent: (name, ch) => `Approved and sent to ${name} via ${ch}`,
    approvedEvidence: "Message approved by the owner and sent. Call booked for Tuesday 14:00.",
    stageLost: "Stage → lost", stageWon: "Stage → won", stageProposal: "Stage → proposal",
    wonEvidence: "Pilot agreed on the discovery call; signed pilot agreement filed as PILOT-D-001.",
    handed: (next) => `Handed to Accounting Agent · Next action: ${next}`,
    formEvidence: "Form: We have 3 clinics and the phones are busy all morning. We want customers to book without calling.",
    proposalEvidence: "Discovery call held; pilot scope for 3 clinics agreed in principle.",
    drafted: (next) => `Drafted: ${next}`,
  },
  msg: {
    newLeadNoOwner: (n, ch) => `New lead: ${n} (${ch}) — no owner yet.`,
    newLeadOwnerTaken: (n, ch) => `New lead: ${n} (${ch}) — no owner yet, taken by the owner.`,
    newLeadAssigned: (n, ch) => `New lead: ${n} (${ch}) — assigned to @sales.`,
    cTaken: "I'll take Customer C myself — the pilot scope needs a decision.",
    aReady: "Context brief is ready for Customer A. I drafted the call-slot message; it needs your approval before it goes out.",
    dWon: "Customer D is won. I handed the pilot invoice to @accounting.",
    askWaiting: "@sales which leads are still waiting on us today?",
    answerWaiting: "Two need attention today: Customer A is waiting for your approval on the call-slot message, and Customer C's pilot proposal is due today with you as owner. Customer B has no owner yet.",
    chatbotNeed: "Most of our leads come from the website at night. We need a chatbot that captures them.",
    accNext: "Pilot invoice for Customer D is next on my list. I will prepare the draft for your approval tomorrow.",
  },
};

const VI: Copy = {
  leads: [
    {
      key: "a", contact_name: "Khách hàng A", company: "Công ty dịch vụ B2B (ẩn danh)", channel: "Zalo", stage: "qualified", minutesAgo: 190,
      need: "Đội sales 6 người hay bỏ sót việc theo dõi sau cuộc gọi đầu tiên; muốn mỗi khách hàng đều có người phụ trách và bước tiếp theo rõ ràng.",
      context: "- Công ty dịch vụ B2B do founder điều hành, 6 nhân viên sales\n- Vấn đề: bỏ sót theo dõi sau cuộc gọi đầu, mỗi khách hàng không có một người phụ trách duy nhất\n- Mức độ gấp: cao — đang chuẩn bị chiến dịch quý 4\n- Rủi ro: đội đang dùng bảng tính, cần thời gian làm quen",
    },
    {
      key: "b", contact_name: "Khách hàng B", company: "Học viện đào tạo (ẩn danh)", channel: "Form website", stage: "new", minutesAgo: 25,
      need: "Hỏi cách AI có thể trả lời thắc mắc của học viên mà nhân viên vẫn kiểm soát được những gì được hứa.", context: null,
    },
    {
      key: "c", contact_name: "Khách hàng C", company: "Chuỗi nha khoa (ẩn danh)", channel: "Form website", stage: "proposal", minutesAgo: 60 * 26,
      need: "Ba phòng khám đang trả lời câu hỏi đặt lịch qua điện thoại; muốn chatbot ghi nhận yêu cầu đặt lịch và chuyển cho lễ tân.",
      context: "- Chuỗi nha khoa 3 chi nhánh, lễ tân quá tải vào giờ cao điểm\n- Nhu cầu: ghi nhận yêu cầu đặt lịch 24/7, nhân viên xác nhận khung giờ\n- Người quyết định: quản lý vận hành; ngân sách quý 4 đã được duyệt\n- Rủi ro: dữ liệu bệnh nhân phải nằm trong quy trình của phòng khám",
    },
    {
      key: "d", contact_name: "Khách hàng D", company: "Doanh nghiệp logistics (ẩn danh)", channel: "Giới thiệu", stage: "won", minutesAgo: 60 * 72,
      need: "Đội chăm sóc khách hàng bỏ sót các khiếu nại giao hàng trên Zalo và email.",
      context: "- Công ty logistics 20 người, khiếu nại đến qua Zalo và email\n- Nhu cầu: mỗi khiếu nại có một người phụ trách và bước tiếp theo rõ ràng\n- Kết quả: đã thống nhất chạy thử sau cuộc gọi trao đổi đầu tiên",
    },
    {
      key: "e", contact_name: "Khách hàng E", company: "Studio thiết kế nội thất (ẩn danh)", channel: "Điện thoại", stage: "lost", minutesAgo: 60 * 96,
      need: "Muốn chuyển toàn bộ dữ liệu sang CRM mới ngay trong tháng này.",
      context: "- Studio nhỏ, 4 nhân viên\n- Yêu cầu chuyển toàn bộ sang CRM mới trong vòng hai tuần\n- Chưa phù hợp với phạm vi hiện tại; xem lại vào quý 1",
    },
    {
      key: "f", contact_name: "Khách hàng F", company: "Chuỗi F&B (ẩn danh)", channel: "Zalo", stage: "qualified", minutesAgo: 60 * 5,
      need: "Quản lý nhượng quyền muốn phản hồi của khách ở từng cửa hàng được xử lý trong vòng 24 giờ.",
      context: "- Chuỗi F&B 8 cửa hàng, phản hồi đến qua Zalo OA\n- Nhu cầu: xử lý trong 24 giờ, mỗi cửa hàng có một người phụ trách rõ ràng\n- Mức độ gấp: trung bình — điểm đánh giá đang giảm trong quý này",
    },
  ],
  salesAgent: {
    role: "Theo dõi khách hàng & báo giá",
    instructions: "Phụ trách mọi khách hàng mới cho đến khi có người nhận việc. Tóm tắt nhu cầu của khách, đề xuất bước tiếp theo và soạn tin nhắn theo dõi. Không gửi giá, giảm giá hay cam kết nào khi chưa được chủ doanh nghiệp duyệt.",
    knowledge: "Chúng tôi giúp doanh nghiệp dịch vụ do founder điều hành vận hành bán hàng và chăm sóc khách hàng bằng AI agent dưới sự kiểm soát của con người. Triển khai mất khoảng hai tuần. Giá được nhân viên xác nhận sau một cuộc trao đổi ngắn.",
    approval: "Mọi tin nhắn gửi cho khách hàng cần được chủ doanh nghiệp duyệt trước khi gửi.",
  },
  accAgent: {
    role: "Hóa đơn & công nợ",
    instructions: "Khi chốt được khách hàng, soạn bản nháp hóa đơn từ phạm vi đã thống nhất. Theo dõi các khoản khách còn nợ và nhắc chủ doanh nghiệp trước hạn thanh toán. Không xuất hóa đơn hay thay đổi số tiền khi chưa được chủ doanh nghiệp duyệt.",
    knowledge: "Hóa đơn xuất bằng VND. Thời hạn thanh toán là 15 ngày, trừ khi báo giá ghi khác.",
    approval: "Hóa đơn và nhắc thanh toán cần được chủ doanh nghiệp duyệt.",
  },
  ch: { zalo: "Zalo", zaloInbox: "Hộp thư Zalo", form: "Form website", referral: "Giới thiệu", phone: "Điện thoại" },
  titles: {
    bookA: "Hẹn cuộc gọi trao đổi với Khách hàng A", proposalC: "Gửi đề xuất chạy thử cho Khách hàng C", confirmF: "Xác nhận quy trình phản hồi với Khách hàng F",
    kickoffD: "Khởi động chạy thử với Khách hàng D", discoveryD: "Cuộc gọi trao đổi với Khách hàng D", invoiceD: "Chuẩn bị hóa đơn chạy thử cho Khách hàng D", qualifyE: "Đánh giá nhu cầu Khách hàng E",
  },
  next: {
    bookA: "Gửi tin nhắn Zalo đề xuất hai khung giờ 30 phút trong tuần này", proposalC: "Xem lại phạm vi chạy thử cho 3 phòng khám và gửi đề xuất",
    confirmF: "Hỏi quản lý nhượng quyền 2 cửa hàng nào sẽ chạy thử trước", kickoffD: "Lên lịch buổi hướng dẫn với trưởng nhóm chăm sóc khách hàng",
    discoveryD: "Đề xuất các khung giờ gọi", invoiceD: "Chuẩn bị hóa đơn chạy thử theo phạm vi đã ký", qualifyE: "Giải thích phạm vi và thời gian hiện tại",
  },
  draftA: "Chào anh/chị, em là trợ lý kinh doanh của NIVO. Cảm ơn anh/chị đã chia sẻ về việc đội sales bị sót follow-up sau cuộc gọi đầu. Bên em xin đề xuất một buổi trao đổi 30 phút để hiểu rõ quy trình hiện tại: thứ Năm 10:00 hoặc thứ Sáu 15:00 tuần này. Anh/chị chọn giúp em khung giờ phù hợp nhé.",
  draftD: "Chào anh/chị, cảm ơn anh/chị đã được giới thiệu tới NIVO. Bên em đề xuất buổi trao đổi 30 phút vào thứ Ba 14:00 để cùng xem cách đội chăm sóc khách hàng đang xử lý khiếu nại giao hàng.",
  ev: {
    salesIncluded: "Module Sales có sẵn trong workspace", accIncluded: "Module Accounting có sẵn trong workspace",
    capturedFrom: (ch) => `Đã ghi nhận khách hàng từ ${ch}`, owner: (who, next) => `Người phụ trách: ${who} · Bước tiếp theo: ${next}`,
    lostEvidence: "Khách cần chuyển toàn bộ sang CRM mới trong hai tuần; nằm ngoài phạm vi hiện tại. Xem lại vào quý 1.",
    contextBrief: "Đã tạo bản tóm tắt bối cảnh", approvedSent: (name, ch) => `Đã duyệt và gửi cho ${name} qua ${ch}`,
    approvedEvidence: "Chủ doanh nghiệp đã duyệt và gửi tin nhắn. Đã hẹn cuộc gọi thứ Ba 14:00.",
    stageLost: "Giai đoạn → không chốt", stageWon: "Giai đoạn → chốt được", stageProposal: "Giai đoạn → đề xuất",
    wonEvidence: "Thống nhất chạy thử trong cuộc gọi trao đổi; thỏa thuận chạy thử đã ký được lưu với mã PILOT-D-001.",
    handed: (next) => `Đã chuyển cho Accounting Agent · Bước tiếp theo: ${next}`,
    formEvidence: "Form: Chúng tôi có 3 phòng khám và điện thoại bận suốt buổi sáng. Chúng tôi muốn khách đặt lịch mà không cần gọi.",
    proposalEvidence: "Đã có cuộc gọi trao đổi; phạm vi chạy thử cho 3 phòng khám được thống nhất về nguyên tắc.",
    drafted: (next) => `Bản nháp: ${next}`,
  },
  msg: {
    newLeadNoOwner: (n, ch) => `Khách hàng mới: ${n} (${ch}) — chưa có người phụ trách.`,
    newLeadOwnerTaken: (n, ch) => `Khách hàng mới: ${n} (${ch}) — chưa có người phụ trách, chủ doanh nghiệp đã nhận.`,
    newLeadAssigned: (n, ch) => `Khách hàng mới: ${n} (${ch}) — đã giao cho @sales.`,
    cTaken: "Tôi sẽ tự phụ trách Khách hàng C — phạm vi chạy thử cần được quyết định.",
    aReady: "Bản tóm tắt bối cảnh của Khách hàng A đã sẵn sàng. Tôi đã soạn tin nhắn đề xuất khung giờ gọi; cần bạn duyệt trước khi gửi đi.",
    dWon: "Đã chốt được Khách hàng D. Tôi đã chuyển hóa đơn chạy thử cho @accounting.",
    askWaiting: "@sales hôm nay khách hàng nào còn đang chờ mình?",
    answerWaiting: "Có hai việc cần chú ý hôm nay: Khách hàng A đang chờ bạn duyệt tin nhắn đề xuất khung giờ gọi, và đề xuất chạy thử của Khách hàng C đến hạn hôm nay, do bạn phụ trách. Khách hàng B chưa có người phụ trách.",
    chatbotNeed: "Phần lớn khách hàng của chúng tôi đến từ website vào ban đêm. Chúng tôi cần một chatbot để ghi nhận họ.",
    accNext: "Hóa đơn chạy thử cho Khách hàng D là việc tiếp theo của tôi. Ngày mai tôi sẽ soạn bản nháp để bạn duyệt.",
  },
};

/** Demo workspace: Sales + Accounting agents and a customer journey at every stage, written in the reader's language. All customer data is illustrative and anonymised. */
export const seedWorkspace = async (supabase: SupabaseClient, ws: string, ownerName: string, locale: Locale) => {
  const c = locale === "vi" ? VI : EN;
  const LEADS = c.leads;
  // Sales and Accounting come pre-installed with the workspace; the Chatbot is what the demo user buys.
  const { data: agentRows } = await supabase.from("agents").insert([
    {
      workspace_id: ws, module: "sales", name: "Sales Agent", handle: "sales", role: c.salesAgent.role,
      instructions: c.salesAgent.instructions, knowledge: c.salesAgent.knowledge, greeting: "", approval_rule: c.salesAgent.approval,
    },
    {
      workspace_id: ws, module: "accounting", name: "Accounting Agent", handle: "accounting", role: c.accAgent.role,
      instructions: c.accAgent.instructions, knowledge: c.accAgent.knowledge, greeting: "", approval_rule: c.accAgent.approval,
    },
  ]).select();
  const bot = agentRows?.find((a) => a.handle === "sales");
  const acc = agentRows?.find((a) => a.handle === "accounting");
  if (!bot || !acc) return;

  const { data: leadRows } = await supabase.from("leads").insert(
    LEADS.map((l) => ({
      workspace_id: ws, contact_name: l.contact_name, company: l.company, channel: l.channel, need: l.need,
      stage: l.stage, context_summary: l.context, created_at: ago(l.minutesAgo),
    })),
  ).select();
  const lead = (key: string) => {
    const seed = LEADS.find((l) => l.key === key)!;
    return leadRows!.find((r) => r.contact_name === seed.contact_name)!;
  };
  const A = lead("a"), B = lead("b"), C = lead("c"), D = lead("d"), E = lead("e"), F = lead("f");
  const { titles: T, next: N, ch, ev: V, msg: M } = c;

  const resp = (l: { id: string }, title: string, agent: boolean, next: string, dueDays: number, status: string, createdMin: number) => ({
    workspace_id: ws, lead_id: l.id, title, owner_kind: agent ? "agent" : "human", owner_agent_id: agent ? bot.id : null,
    owner_name: agent ? bot.name : ownerName, next_action: next, due_at: days(dueDays), status, created_at: ago(createdMin),
  });
  const { data: respRows } = await supabase.from("responsibilities").insert([
    resp(A, T.bookA, true, N.bookA, 1, "waiting_approval", 170),
    resp(C, T.proposalC, false, N.proposalC, 0, "open", 60 * 24),
    resp(F, T.confirmF, true, N.confirmF, 2, "open", 60 * 4),
    resp(D, T.kickoffD, false, N.kickoffD, -1, "open", 60 * 48),
    resp(D, T.discoveryD, true, N.discoveryD, -3, "done", 60 * 70),
    { ...resp(D, T.invoiceD, true, N.invoiceD, 1, "open", 60 * 47), owner_agent_id: acc.id, owner_name: acc.name },
    resp(E, T.qualifyE, false, N.qualifyE, -3, "done", 60 * 94),
  ]).select();
  const r = (title: string) => respRows!.find((x) => x.title === title)!;

  await supabase.from("executions").insert([
    { workspace_id: ws, responsibility_id: r(T.bookA).id, agent_id: bot.id, status: "pending_approval", created_at: ago(160), draft: c.draftA },
    {
      workspace_id: ws, responsibility_id: r(T.discoveryD).id, agent_id: bot.id, status: "approved", decided_by: ownerName, decided_at: ago(60 * 69), created_at: ago(60 * 69 + 10),
      draft: c.draftD,
    },
  ]);

  const ev = (l: { id: string } | null, kind: string, actor: string, summary: string, min: number, evidence: string | null = null) =>
    ({ workspace_id: ws, lead_id: l?.id ?? null, kind, actor, summary, created_at: ago(min), evidence });
  await supabase.from("events").insert([
    ev(null, "agent.installed", "NIVO", V.salesIncluded, 60 * 120),
    ev(null, "agent.installed", "NIVO", V.accIncluded, 60 * 120),
    ev(E, "lead.captured", ch.phone, V.capturedFrom(ch.phone), 60 * 96),
    ev(E, "responsibility.assigned", ownerName, V.owner(ownerName, N.qualifyE), 60 * 95),
    ev(E, "outcome.recorded", ownerName, V.stageLost, 60 * 90, V.lostEvidence),
    ev(D, "lead.captured", ch.referral, V.capturedFrom(ch.referral), 60 * 72),
    ev(D, "context.summarised", "NIVO AI", V.contextBrief, 60 * 71),
    ev(D, "responsibility.assigned", "NIVO AI", V.owner("Sales Agent", N.discoveryD), 60 * 70),
    ev(D, "execution.drafted", "Sales Agent", V.drafted(N.discoveryD), 60 * 69 + 10),
    ev(D, "execution.approved", ownerName, V.approvedSent(D.contact_name, ch.referral), 60 * 69, V.approvedEvidence),
    ev(D, "outcome.recorded", ownerName, V.stageWon, 60 * 50, V.wonEvidence),
    ev(D, "responsibility.assigned", ownerName, V.owner(ownerName, N.kickoffD), 60 * 48),
    ev(D, "responsibility.assigned", "Sales Agent", V.handed(N.invoiceD), 60 * 47),
    ev(C, "lead.captured", ch.form, V.capturedFrom(ch.form), 60 * 26, V.formEvidence),
    ev(C, "context.summarised", "NIVO AI", V.contextBrief, 60 * 26 - 1),
    ev(C, "outcome.recorded", ownerName, V.stageProposal, 60 * 25, V.proposalEvidence),
    ev(C, "responsibility.assigned", ownerName, V.owner(ownerName, N.proposalC), 60 * 24),
    ev(F, "lead.captured", ch.zaloInbox, V.capturedFrom(ch.zalo), 60 * 5),
    ev(F, "context.summarised", "NIVO AI", V.contextBrief, 60 * 5 - 1),
    ev(F, "responsibility.assigned", "NIVO AI", V.owner("Sales Agent", N.confirmF), 60 * 4),
    ev(A, "lead.captured", ch.zaloInbox, V.capturedFrom(ch.zalo), 190),
    ev(A, "context.summarised", "NIVO AI", V.contextBrief, 185),
    ev(A, "responsibility.assigned", "NIVO AI", V.owner("Sales Agent", N.bookA), 170),
    ev(A, "execution.drafted", "Sales Agent", V.drafted(N.bookA), 160),
    ev(B, "lead.captured", ch.form, V.capturedFrom(ch.form), 25),
  ]);

  const msg = (kind: "system" | "agent" | "human", body: string, min: number, l: { id: string } | null = null) => ({
    workspace_id: ws, author_kind: kind, author_name: kind === "system" ? "NIVO" : kind === "agent" ? bot.name : ownerName,
    agent_id: kind === "agent" ? bot.id : null, body, lead_id: l?.id ?? null, created_at: ago(min),
  });
  await supabase.from("messages").insert([
    msg("system", M.newLeadOwnerTaken(C.contact_name, ch.form), 60 * 26, C),
    msg("human", M.cTaken, 60 * 24),
    msg("system", M.newLeadAssigned(F.contact_name, ch.zalo), 60 * 4, F),
    msg("system", M.newLeadAssigned(A.contact_name, ch.zalo), 170, A),
    msg("agent", M.aReady, 160, A),
    msg("agent", M.dWon, 60 * 47, D),
    msg("human", M.askWaiting, 40),
    msg("agent", M.answerWaiting, 39),
    msg("system", M.newLeadNoOwner(B.contact_name, ch.form), 25, B),
    msg("human", M.chatbotNeed, 20),
    { workspace_id: ws, author_kind: "agent", author_name: acc.name, agent_id: acc.id, body: M.accNext, lead_id: D.id, created_at: ago(60 * 46) },
  ]);

  // Operating flow: authority, default rules and the simulated flow examples (also backfilled from the session for old workspaces).
  await ensureFlowDefaults(supabase, ws, ownerName, locale);

};
