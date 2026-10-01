#!/usr/bin/env node
// Seeds a ready-to-use demo account ("Spa Hoa Mai") into whichever Supabase project the env points at. Idempotent.
//   NIVO_SECRETS="$USERPROFILE/.nivo-lite/cloud.env" npm run -s seed:workspace [-- <workspaceId>]
// Workspace: argv[2] | $SEED_WORKSPACE_ID | the production default below. Falls back to the first workspace, then creates one.
// Creates: owner + staff accounts (passwords go ONLY into ~/.nivo-lite/secrets.env), the 3 module installations applied
// exactly like src/lib/module-actions.ts (applySetup), and the business knowledge (chunk + embed like src/lib/knowledge).
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_WORKSPACE = "0226212c-0bf6-414a-843c-1499cb426082";
const WS_NAME = "Spa Hoa Mai";
const BUSINESS_TYPE = "services"; // onboarding set: retail | services | clinic | education | other
const OWNER = { email: "mai@nivo.vn", name: "Chị Mai", role: "owner", key: "OWNER" };
const STAFF = { email: "ha@nivo.vn", name: "Chị Hà", role: "staff", key: "STAFF" };
const SECRETS_FILE = join(homedir(), ".nivo-lite", "secrets.env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run through scripts/with-secrets.mjs)"); process.exit(1); }
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const log = (...a) => console.log("[seed]", ...a);

/* ------------------------------------------------------------------ secrets file (passwords never printed) */
const readEnvFile = () => (existsSync(SECRETS_FILE) ? readFileSync(SECRETS_FILE, "utf8") : "");
const envGet = (text, k) => text.match(new RegExp(`^\\s*${k}\\s*=\\s*(.*)\\s*$`, "m"))?.[1]?.replace(/^["']|["']$/g, "") || "";
const envSet = (text, k, v) => {
  const line = `${k}=${v}`;
  const re = new RegExp(`^\\s*${k}\\s*=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  return `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
};
const strongPassword = () => randomBytes(18).toString("base64url"); // 24 chars

/* ------------------------------------------------------------------ accounts */
const findUser = async (email) => {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
};

let secretsText = readEnvFile();
const ensureUser = async (acct) => {
  const pwKey = `READY_${acct.key}_PASSWORD`;
  let password = envGet(secretsText, pwKey);
  if (envGet(secretsText, `READY_${acct.key}_EMAIL`) !== acct.email) password = ""; // stale entry for another email
  if (password.length < 16) password = strongPassword();
  const meta = { full_name: acct.name };
  let user = await findUser(acct.email);
  if (user) {
    ok(await db.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { ...(user.user_metadata ?? {}), ...meta } }), `update ${acct.email}`);
    log(`user exists: ${acct.email} (password set)`);
  } else {
    const r = ok(await db.auth.admin.createUser({ email: acct.email, password, email_confirm: true, user_metadata: meta }), `create ${acct.email}`);
    user = r.user;
    log(`user created: ${acct.email}`);
  }
  secretsText = envSet(secretsText, `READY_${acct.key}_EMAIL`, acct.email);
  secretsText = envSet(secretsText, pwKey, password);
  return user;
};
const owner = await ensureUser(OWNER);
const staffUser = await ensureUser(STAFF);
mkdirSync(dirname(SECRETS_FILE), { recursive: true });
writeFileSync(SECRETS_FILE, secretsText);
log(`credentials written to ${SECRETS_FILE}`);

/* ------------------------------------------------------------------ 1. workspace */
const wsArg = process.argv[2] || process.env.SEED_WORKSPACE_ID || DEFAULT_WORKSPACE;
let ws = ok(await db.from("workspaces").select("*").eq("id", wsArg).maybeSingle(), "workspace lookup");
if (!ws) {
  ws = ok(await db.from("workspaces").select("*").order("created_at").limit(1).maybeSingle(), "workspace fallback");
  if (ws) log(`workspace ${wsArg} not found; using the first workspace ${ws.id}`);
}
if (!ws) {
  ws = ok(await db.from("workspaces").insert({ owner_id: owner.id, name: WS_NAME, status: "active", business_type: BUSINESS_TYPE }).select().single(), "workspace create");
  log(`workspace created ${ws.id}`);
}
const WS = ws.id;
ok(await db.from("workspaces").update({ name: WS_NAME, business_type: BUSINESS_TYPE, status: "active" }).eq("id", WS), "workspace update");
log(`workspace ${WS}: name="${WS_NAME}" business_type=${BUSINESS_TYPE} status=active`);

/* ------------------------------------------------------------------ 2. members */
const upsertMember = async (user, acct, staffId) => {
  const row = { workspace_id: WS, user_id: user.id, role: acct.role, display_name: acct.name, status: "active" };
  if (staffId !== undefined) row.staff_id = staffId;
  ok(await db.from("workspace_members").upsert(row, { onConflict: "workspace_id,user_id" }), `member ${acct.email}`);
};
await upsertMember(owner, OWNER);
// The old `staff` table has no user_id column; the optional link lives on workspace_members.staff_id (unique per staff).
let staffId = null;
{
  const rows = ok(await db.from("staff").select("id,name").eq("workspace_id", WS).ilike("name", "%Hà%"), "staff lookup");
  const cand = rows.find((s) => s.name.trim().toLowerCase() === "chị hà") ?? rows[0];
  if (cand) {
    const taken = ok(await db.from("workspace_members").select("user_id").eq("workspace_id", WS).eq("staff_id", cand.id), "staff link check");
    if (taken.every((m) => m.user_id === staffUser.id)) staffId = cand.id;
  }
}
await upsertMember(staffUser, STAFF, staffId);
log(`members: ${OWNER.email} owner, ${STAFF.email} staff${staffId ? " (linked to staff row Chị Hà)" : ""}`);

/* ------------------------------------------------------------------ 3. modules */
// Gate catalogue (mirror of MODULE_GATES in src/lib/modules-shared.ts, vi labels).
const GATES = {
  chatbot: ["identity", "products", "support_scope", "channels", "hours_sla", "handoff", "prohibited", "tone"],
  sales: ["offer_pricing", "qualification", "followup_cadence", "approval_thresholds", "handoff_accounting", "tone"],
  accounting: ["scope", "currency_tax", "source_evidence", "approval_policy", "evidence_requirements", "prohibited_actions"],
};
const GATE_LABEL_VI = {
  chatbot: { identity: "Thông tin doanh nghiệp", products: "Sản phẩm và giá", support_scope: "Phạm vi hỗ trợ", channels: "Kênh tiếp nhận", hours_sla: "Giờ làm việc và thời gian phản hồi", handoff: "Khi nào chuyển cho người", prohibited: "Điều không được hứa", tone: "Giọng điệu" },
  sales: { offer_pricing: "Gói bán và quy tắc giá", qualification: "Tiêu chí khách tiềm năng", followup_cadence: "Nhịp theo dõi", approval_thresholds: "Ngưỡng cần duyệt", handoff_accounting: "Chuyển sang Kế toán", tone: "Giọng điệu" },
  accounting: { scope: "Phạm vi công việc", currency_tax: "Tiền tệ và thuế", source_evidence: "Nguồn chứng từ", approval_policy: "Chính sách duyệt và ngưỡng", evidence_requirements: "Yêu cầu chứng từ", prohibited_actions: "Việc không được làm" },
};
const MODULE_NAME_VI = { chatbot: "Chatbot", sales: "Sales", accounting: "Kế toán" };
const WELCOME_VI = (m) => `Chào bạn, mình là NIVO. Mình sẽ cùng bạn thiết lập ${m}. Bạn kể về doanh nghiệp bằng lời của bạn nhé. Mình ghi lại phần mình hiểu và hỏi thêm phần còn thiếu.`;
const MODE = { chatbot: "autopilot", sales: "autopilot", accounting: "autopilot" };

const SETUP = {
  chatbot: {
    summary: "Spa Hoa Mai là spa chăm sóc da và thư giãn tại 123 Nguyễn Trãi, Quận 1, TP.HCM (địa chỉ mẫu). Chatbot tư vấn dịch vụ, báo giá niêm yết, nhận đặt lịch qua Telegram và website, và chuyển cho Chị Hà khi khách hỏi về da/y khoa hoặc xin giảm giá.",
    facts: [
      ["hours", "Giờ mở cửa 9:00–20:00 mỗi ngày, Chủ nhật đóng cửa lúc 18:00."],
      ["address", "Địa chỉ: 123 Nguyễn Trãi, Quận 1, TP.HCM (địa chỉ mẫu)."],
      ["deposit", "Combo cần đặt cọc 30%; huỷ trước giờ hẹn ít nhất 4 tiếng thì được hoàn cọc."],
      ["handoff", "Chị Hà phụ trách câu hỏi về da/y khoa và mọi yêu cầu giảm giá."],
      ["tone", "Khách là \"anh/chị\", bot xưng \"em\"."],
    ],
    gates: {
      identity: "Spa Hoa Mai, spa chăm sóc da và thư giãn tại 123 Nguyễn Trãi, Quận 1, TP.HCM (địa chỉ mẫu). Phục vụ khách nữ và nam từ 16 tuổi; trẻ em dưới 12 tuổi cần có người lớn đi cùng.",
      products: "Gội đầu dưỡng sinh 150.000đ/45 phút; Facial cơ bản 350.000đ/60 phút; Facial chuyên sâu 550.000đ/75 phút; Massage body đá nóng 450.000đ/60 phút; Combo thư giãn 590.000đ/90 phút (gội đầu + massage cổ vai gáy + chăm sóc da cơ bản); Gói 10 buổi facial 3.150.000đ. Chỉ báo giá niêm yết.",
      support_scope: "Được trả lời: dịch vụ, bảng giá niêm yết, giờ mở cửa, địa chỉ, gửi xe, hình thức thanh toán, chính sách đặt lịch/đặt cọc/huỷ. Không trả lời: tư vấn tình trạng da hay vấn đề y khoa, giảm giá, đàm phán giá.",
      channels: "Telegram và website. Khách nhắn qua hai kênh này, bot trả lời cùng một nội dung.",
      hours_sla: "Giờ làm việc 9:00–20:00, Chủ nhật đến 18:00. Trong giờ làm việc nhân viên phản hồi các việc bot chuyển trong vòng 30 phút; ngoài giờ bot nhận thông tin và hẹn phản hồi vào đầu giờ sáng hôm sau.",
      handoff: "Chuyển cho Chị Hà khi khách hỏi về da, dị ứng, mang thai, bệnh lý, hoặc xin giảm giá/ưu đãi. Chuyển cho Chị Mai khi khách khiếu nại hoặc cần hoàn tiền.",
      prohibited: "Không hứa kết quả điều trị (trắng da, hết mụn, giảm cân...). Không hứa hay tự đồng ý giảm giá. Không tự xác nhận hoàn cọc ngoài quy định huỷ trước 4 tiếng.",
      tone: "Gọi khách là \"anh/chị\", bot xưng \"em\". Lịch sự, ấm áp, ngắn gọn, mở đầu bằng \"Dạ\".",
    },
    chat: [
      ["Bạn kể cho mình nghe spa của bạn là gì, ở đâu và phục vụ ai nhé?", "Spa Hoa Mai làm chăm sóc da và thư giãn, ở 123 Nguyễn Trãi, Quận 1. Khách chủ yếu là chị em văn phòng, có cả khách nam. Trẻ nhỏ thì phải có người lớn đi cùng."],
      ["Cảm ơn Chị Mai. Spa đang có những dịch vụ nào và giá bao nhiêu?", "Gội đầu dưỡng sinh 150k, facial cơ bản 350k, facial chuyên sâu 550k, massage body đá nóng 450k. Có combo thư giãn 590k và gói 10 buổi facial 3.150.000đ. Em cứ báo đúng giá niêm yết thôi."],
      ["Khách nhắn qua những kênh nào, và spa mở cửa lúc mấy giờ?", "Telegram với website. Spa mở 9 giờ đến 20 giờ, riêng Chủ nhật đóng lúc 18 giờ."],
      ["Những câu nào bot không được tự trả lời mà phải chuyển cho người?", "Hỏi về da, dị ứng, bầu bí, bệnh thì chuyển cho Chị Hà. Ai xin giảm giá cũng chuyển cho Chị Hà. Bot không được hứa kết quả điều trị hay hứa giảm giá."],
      ["Bot nên xưng hô với khách thế nào?", "Gọi khách là anh/chị, bot xưng là em, nói nhẹ nhàng, mở đầu bằng \"Dạ\"."],
    ],
  },
  sales: {
    summary: "Sales của Spa Hoa Mai chăm khách hỏi dịch vụ: xác định khách có nhu cầu thật, theo dõi sau 1 ngày (tối đa 3 lần), đơn từ 2.000.000đ cần Chị Mai duyệt, và coi là chốt khi đã xác nhận đặt cọc hoặc thanh toán.",
    facts: [
      ["followup", "Theo dõi lại sau 1 ngày, tối đa 3 lần."],
      ["approval", "Đơn từ 2.000.000đ cần Chị Mai duyệt."],
      ["won", "Đơn được tính là chốt khi đã xác nhận đặt cọc hoặc thanh toán."],
      ["discount", "Mọi yêu cầu giảm giá chuyển Chị Hà, không tự hứa."],
    ],
    gates: {
      offer_pricing: "Bán các dịch vụ spa theo bảng giá niêm yết (150.000đ đến 590.000đ mỗi buổi, gói 10 buổi facial 3.150.000đ). Không tự giảm giá; mọi yêu cầu giảm giá chuyển Chị Hà.",
      qualification: "Khách đáng theo đuổi: nêu rõ dịch vụ muốn làm, hỏi lịch hoặc để lại số liên hệ. Bỏ qua: hỏi chung chung không phản hồi sau 3 lần theo dõi, hoặc yêu cầu ngoài dịch vụ của spa.",
      followup_cadence: "Theo dõi lại sau 1 ngày nếu khách chưa trả lời, tối đa 3 lần, rồi dừng và ghi chú lý do.",
      approval_thresholds: "Báo giá hoặc đơn từ 2.000.000đ trở lên cần Chị Mai duyệt trước khi gửi khách. Dưới ngưỡng này được gửi theo bảng giá niêm yết.",
      handoff_accounting: "Đơn được tính là chốt khi đã xác nhận đặt cọc (30% với combo) hoặc thanh toán. Khi đó chuyển Kế toán kèm tên khách, dịch vụ, số tiền và hình thức thanh toán.",
      tone: "Gọi khách là \"anh/chị\", xưng \"em\". Thân thiện, không thúc ép, không hứa kết quả điều trị.",
    },
    chat: [
      ["Spa bán những gì và có quy tắc giá nào Sales cần nhớ không?", "Bán dịch vụ spa theo bảng giá niêm yết. Sales không tự giảm giá nhé, ai xin giảm thì chuyển Chị Hà."],
      ["Khách như thế nào thì mình nên theo đuổi?", "Khách nói rõ muốn làm dịch vụ gì, hỏi lịch hoặc để lại số điện thoại. Hỏi cho biết rồi im thì theo ba lần là thôi."],
      ["Mình theo dõi khách bao lâu một lần, tối đa mấy lần?", "Sau một ngày chưa trả lời thì nhắn lại, tối đa ba lần."],
      ["Đơn bao nhiêu tiền thì cần Chị Mai duyệt?", "Từ 2 triệu trở lên thì phải qua chị duyệt."],
      ["Khi nào mình coi là chốt đơn và chuyển sang Kế toán?", "Khi khách đã đặt cọc hoặc thanh toán và mình xác nhận được. Lúc đó chuyển kế toán."],
    ],
  },
  accounting: {
    summary: "Kế toán của Spa Hoa Mai là hộ kinh doanh: ghi nhận bằng VND, mặc định không xuất hoá đơn VAT, đối soát từ chuyển khoản Vietcombank và đơn hàng, khoản chưa rõ thì hỏi Chị Mai, nhắc thanh toán với giọng lịch sự.",
    facts: [
      ["currency", "Đơn vị tiền: VND."],
      ["vat", "Hộ kinh doanh, mặc định không xuất hoá đơn VAT."],
      ["source", "Nguồn số liệu: chuyển khoản Vietcombank và đơn hàng."],
      ["unclear", "Khoản tiền chưa rõ thì hỏi Chị Mai."],
      ["reminder", "Nhắc thanh toán với giọng lịch sự."],
    ],
    gates: {
      scope: "Ghi nhận thanh toán và đặt cọc, đối soát chuyển khoản với đơn hàng, theo dõi công nợ và nhắc khách thanh toán còn thiếu với giọng lịch sự.",
      currency_tax: "Tiền tệ VND, không dùng số lẻ. Spa là hộ kinh doanh nên mặc định không xuất hoá đơn VAT; chỉ lập khi Chị Mai yêu cầu.",
      source_evidence: "Số liệu lấy từ các khoản chuyển khoản vào tài khoản Vietcombank của spa và từ đơn hàng trong hệ thống.",
      approval_policy: "Khoản khớp đơn hàng và đúng số tiền thì tự ghi nhận. Khoản chưa rõ (không khớp đơn, sai số tiền, người chuyển lạ) phải hỏi Chị Mai trước khi ghi nhận.",
      evidence_requirements: "Ghi nhận thanh toán khi có giao dịch Vietcombank khớp số tiền và nội dung chuyển khoản hoặc mã đơn; tiền mặt cần Chị Mai hoặc Chị Hà xác nhận.",
      prohibited_actions: "Không tự hoàn tiền hay hoàn cọc, không tự huỷ hay sửa giao dịch đã ghi, không tự hứa miễn giảm công nợ. Các việc này cần Chị Mai duyệt.",
    },
    chat: [
      ["Kế toán AI cần làm những việc gì cho spa?", "Ghi nhận khách đã chuyển khoản hay đặt cọc chưa, đối chiếu với đơn, và nhắc khách còn thiếu tiền."],
      ["Spa dùng tiền gì và có xuất hoá đơn VAT không?", "Tiền Việt thôi. Spa là hộ kinh doanh nên mình không xuất hoá đơn VAT, trừ khi chị bảo."],
      ["Số liệu lấy từ đâu và khoản nào không rõ thì làm sao?", "Lấy từ tiền chuyển khoản vào Vietcombank và các đơn hàng. Khoản nào không khớp thì hỏi chị, đừng tự ghi."],
      ["Có việc nào mình tuyệt đối không được tự làm không?", "Không được tự hoàn tiền, hoàn cọc hay sửa giao dịch đã ghi. Nhắc khách thì nói lịch sự, nhẹ nhàng."],
    ],
  },
};

const BLOCK_START = "### NIVO setup";
const BLOCK_END = "### end NIVO setup";
const stripBlock = (t) => t.replace(/\n*### NIVO setup[\s\S]*?### end NIVO setup\s*/g, "").trimEnd();
const agentTexts = (moduleKey, snapshot, version) => {
  const rules = GATES[moduleKey].map((k) => `- ${GATE_LABEL_VI[moduleKey][k]}: ${snapshot.gates[k].evidence}`).join("\n");
  const facts = snapshot.facts.map((f) => `- ${f.text}`).join("\n");
  return {
    instructions: `${BLOCK_START} v${version}\nConfirmed by the owner. Follow these rules exactly; when something is not covered, say a team member will confirm.\n${rules}\n${BLOCK_END}`,
    knowledge: `${BLOCK_START} v${version}\n${snapshot.summary}\n${facts}\n${rules}\n${BLOCK_END}`,
  };
};
const logEvent = (kind, actor, summary) => db.from("events").insert({ workspace_id: WS, lead_id: null, kind, actor, summary, evidence: null });

const seedModule = async (moduleKey) => {
  const spec = SETUP[moduleKey];
  // agent: reuse the workspace's existing one
  let agent = ok(await db.from("agents").select("id").eq("workspace_id", WS).eq("module", moduleKey).order("created_at").limit(1).maybeSingle(), `agent ${moduleKey}`);
  if (!agent) {
    agent = ok(await db.from("agents").insert({
      workspace_id: WS, module: moduleKey, name: `${MODULE_NAME_VI[moduleKey]} Agent`, handle: moduleKey, role: MODULE_NAME_VI[moduleKey], instructions: "",
    }).select("id").single(), `agent create ${moduleKey}`);
  }
  let inst = ok(await db.from("module_installations").select("*").eq("workspace_id", WS).eq("module_key", moduleKey).maybeSingle(), `installation ${moduleKey}`);
  let created = false;
  if (!inst) {
    inst = ok(await db.from("module_installations").insert({ workspace_id: WS, module_key: moduleKey, agent_id: agent.id, status: "setup" }).select().single(), `install ${moduleKey}`);
    await logEvent("module.installed", OWNER.name, `${OWNER.name}: ${MODULE_NAME_VI[moduleKey]}`);
    created = true;
  } else if (!inst.agent_id) {
    ok(await db.from("module_installations").update({ agent_id: agent.id }).eq("id", inst.id), "installation agent");
    inst.agent_id = agent.id;
  }
  const agentId = inst.agent_id ?? agent.id;

  const confirmedAt = new Date().toISOString();
  const gates = Object.fromEntries(GATES[moduleKey].map((k) => {
    if (!spec.gates[k]) throw new Error(`missing gate evidence ${moduleKey}.${k}`);
    return [k, { status: "confirmed", evidence: spec.gates[k], confirmed_by: OWNER.name, confirmed_at: confirmedAt }];
  }));
  const draft = { summary: spec.summary, facts: spec.facts.map(([key, text]) => ({ key, text })) };

  const existingV1 = ok(await db.from("module_context_versions").select("*").eq("installation_id", inst.id).eq("version", 1).maybeSingle(), "version lookup");
  let version = existingV1;
  const fresh = !existingV1;
  let snapshot;
  if (fresh) {
    // revision 1 session: the one that gets applied
    let s1 = ok(await db.from("module_setup_sessions").select("*").eq("installation_id", inst.id).eq("revision", 1).maybeSingle(), "session1 lookup");
    if (!s1) s1 = ok(await db.from("module_setup_sessions").insert({ workspace_id: WS, installation_id: inst.id, revision: 1, status: "draft", draft_snapshot: draft, gate_evidence: gates }).select().single(), "session1");
    else ok(await db.from("module_setup_sessions").update({ draft_snapshot: draft, gate_evidence: gates }).eq("id", s1.id), "session1 update");
    // setup chat, one question at a time, spaced over the last minutes so ordering is stable
    const have = ok(await db.from("module_setup_messages").select("id").eq("setup_session_id", s1.id).limit(1), "messages check");
    if (have.length === 0) {
      let t = Date.now() - 45 * 60_000;
      const rows = [{ role: "assistant", author: "NIVO", body: WELCOME_VI(MODULE_NAME_VI[moduleKey]) }];
      for (const [q, a] of spec.chat) rows.push({ role: "assistant", author: "NIVO", body: q }, { role: "user", author: OWNER.name, body: a });
      rows.push({ role: "assistant", author: "NIVO", body: "Mình đã ghi nhận đủ các mục cần thiết và Chị Mai đã xác nhận. Mình áp dụng cấu hình này nhé." });
      ok(await db.from("module_setup_messages").insert(rows.map((r) => ({ workspace_id: WS, setup_session_id: s1.id, ...r, created_at: new Date((t += 90_000)).toISOString() }))), "setup messages");
    }
    snapshot = { summary: draft.summary, facts: draft.facts, gates: Object.fromEntries(Object.entries(gates).filter(([, g]) => g.status === "confirmed")) };
    version = ok(await db.from("module_context_versions").insert({ workspace_id: WS, installation_id: inst.id, version: 1, snapshot, applied_by: OWNER.name }).select().single(), "context version");
    ok(await db.from("module_setup_sessions").update({ status: "applied" }).eq("id", s1.id), "close session1");
    await logEvent("module.context_applied", OWNER.name, `${MODULE_NAME_VI[moduleKey]} v1`);
  } else {
    snapshot = existingV1.snapshot;
  }

  // agent marked blocks (replaced in place, so re-running is safe)
  const cur = ok(await db.from("agents").select("instructions, knowledge").eq("id", agentId).single(), "agent read");
  const texts = agentTexts(moduleKey, snapshot, 1);
  ok(await db.from("agents").update({
    instructions: `${stripBlock(cur.instructions ?? "")}\n\n${texts.instructions}`.trim(),
    knowledge: `${stripBlock(cur.knowledge ?? "")}\n\n${texts.knowledge}`.trim(),
  }).eq("id", agentId), "agent texts");

  // fresh draft revision 2 (copy of what was applied, like ensureDraftSession)
  const s2 = ok(await db.from("module_setup_sessions").select("id").eq("installation_id", inst.id).eq("revision", 2).maybeSingle(), "session2 lookup");
  if (!s2) ok(await db.from("module_setup_sessions").insert({ workspace_id: WS, installation_id: inst.id, revision: 2, status: "draft", draft_snapshot: draft, gate_evidence: gates }), "session2");

  if (fresh) {
    // live + operating mode, as setModuleLive / setOperatingMode do
    ok(await db.from("module_installations").update({ active_context_version_id: version.id, status: "live", live_enabled: true, operating_mode: MODE[moduleKey] }).eq("id", inst.id), "installation live");
    // Authority rules are left as they are: the per-action defaults (auto within limits, ask for quotes) already match autopilot.
    ok(await db.from("agents").update({ status: "active" }).eq("id", agentId), "agent active");
  } else if (!inst.active_context_version_id) {
    ok(await db.from("module_installations").update({ active_context_version_id: version.id }).eq("id", inst.id), "installation pointer");
  }
  log(`module ${moduleKey}: ${created ? "installed" : "installation existed"}, ${fresh ? "context v1 applied, live, mode " + MODE[moduleKey] : "context v1 already applied (kept)"}`);
};
for (const m of ["chatbot", "sales", "accounting"]) await seedModule(m);

/* ------------------------------------------------------------------ 4. knowledge (chunk + embed, replicated from src/lib/knowledge) */
const CHUNK_SIZE = 800, CHUNK_OVERLAP = 120;
const clean = (t) => t.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const splitLong = (block, max) => {
  if (block.length <= max) return [block];
  const out = []; let rest = block;
  while (rest.length > max) {
    const w = rest.slice(0, max);
    let cut = Math.max(w.lastIndexOf(". "), w.lastIndexOf("\n"), w.lastIndexOf("; "), w.lastIndexOf("! "), w.lastIndexOf("? "));
    if (cut < max * 0.4) cut = w.lastIndexOf(" ");
    if (cut < max * 0.4) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
};
const chunkText = (text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) => {
  const body = clean(text); if (!body) return [];
  const blocks = body.split(/\n{2,}/).flatMap((b) => splitLong(b.trim(), size)).filter(Boolean);
  const packed = []; let cur = "";
  for (const b of blocks) { if (cur && cur.length + 2 + b.length > size) { packed.push(cur); cur = b; } else cur = cur ? `${cur}\n\n${b}` : b; }
  if (cur) packed.push(cur);
  if (overlap <= 0 || packed.length < 2) return packed;
  return packed.map((p, i) => {
    if (i === 0) return p;
    let tail = (packed[i - 1] ?? "").slice(-overlap);
    const sp = tail.indexOf(" "); if (sp > 0 && sp < tail.length - 10) tail = tail.slice(sp + 1);
    return `${tail.trim()}\n${p}`;
  });
};
const embedKey = process.env.EMBEDDING_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
const embedBase = (process.env.EMBEDDING_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const embedModel = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";
const embedTexts = async (texts) => {
  if (!embedKey || !texts.length) return null;
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const input = texts.slice(i, i + 16).map((t) => t.slice(0, 8000));
    const res = await fetch(`${embedBase}/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${embedKey}` }, body: JSON.stringify({ model: embedModel, input }) });
    if (!res.ok) { console.error(`embeddings provider ${res.status}`); return null; }
    const rows = [...((await res.json()).data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (rows.length !== input.length || rows.some((r) => r.embedding?.length !== 1536)) { console.error("embeddings: unexpected shape"); return null; }
    out.push(...rows.map((r) => r.embedding));
  }
  return out;
};
const toVector = (v) => `[${v.join(",")}]`;

const faq = (pairs) => pairs.map(([q, a]) => `Hỏi: ${q}\nĐáp: ${a}`).join("\n\n");
const SOURCES = [
  {
    title: "Dịch vụ và bảng giá", kind: "text", topic: "Dịch vụ", visibility: "public",
    content: `Bảng giá dịch vụ Spa Hoa Mai (giá niêm yết):

Gội đầu dưỡng sinh: 150.000đ, 45 phút.

Facial cơ bản: 350.000đ, 60 phút.

Facial chuyên sâu: 550.000đ, 75 phút.

Massage body đá nóng: 450.000đ, 60 phút.

Combo thư giãn: 590.000đ, 90 phút. Gồm gội đầu dưỡng sinh, massage cổ vai gáy và chăm sóc da cơ bản.

Gói 10 buổi facial: 3.150.000đ cho 10 buổi facial.`,
  },
  {
    title: "Chính sách đặt lịch, đặt cọc và huỷ", kind: "text", topic: "Chính sách", visibility: "public",
    content: `Giờ mở cửa: 9:00–20:00 mỗi ngày, Chủ nhật đến 18:00. Khách nên đặt lịch trước qua Telegram hoặc website để được xếp giờ phù hợp.

Đặt cọc: Combo thư giãn và các gói nhiều buổi cần đặt cọc 30% giá trị để giữ lịch. Phần còn lại thanh toán tại spa sau khi sử dụng dịch vụ. Các dịch vụ lẻ không cần đặt cọc.

Huỷ và đổi lịch: Khách huỷ hoặc đổi lịch trước giờ hẹn ít nhất 4 tiếng sẽ được hoàn lại tiền cọc. Huỷ trong vòng 4 tiếng trước giờ hẹn hoặc không đến thì tiền cọc không được hoàn.

Đến trễ: Spa giữ lịch tối đa 15 phút; sau đó nhân viên sẽ liên hệ để sắp xếp lại.

Spa không cam kết kết quả điều trị. Câu hỏi về tình trạng da, dị ứng, mang thai hoặc bệnh lý sẽ do Chị Hà tư vấn trực tiếp.`,
  },
  {
    title: "Hỏi đáp thường gặp", kind: "faq", topic: "Hỏi đáp", visibility: "public",
    content: faq([
      ["Spa có chỗ gửi xe không?", "Dạ spa gửi xe miễn phí cho khách trong thời gian sử dụng dịch vụ ạ."],
      ["Spa nhận thanh toán bằng hình thức nào?", "Dạ spa nhận chuyển khoản, quẹt thẻ và tiền mặt ạ."],
      ["Spa ở đâu và mở cửa lúc mấy giờ?", "Dạ spa ở 123 Nguyễn Trãi, Quận 1, TP.HCM (địa chỉ mẫu). Spa mở cửa 9:00–20:00 mỗi ngày, Chủ nhật đến 18:00 ạ."],
      ["Spa có phòng riêng không?", "Dạ có ạ, mỗi khách được phục vụ trong phòng riêng; spa cũng có phòng đôi cho khách đi cùng người thân hoặc bạn bè."],
      ["Trẻ em có làm dịch vụ được không?", "Dạ trẻ em dưới 12 tuổi cần có người lớn đi cùng. Facial và massage body dành cho khách từ 16 tuổi ạ."],
    ]),
  },
  {
    title: "Quy trình nội bộ: phân công và duyệt giảm giá", kind: "text", topic: "Quy trình nội bộ", visibility: "internal",
    content: `Phân công: Câu hỏi về da, dị ứng, mang thai, bệnh lý và mọi yêu cầu giảm giá do Chị Hà xử lý. Khiếu nại và hoàn tiền do Chị Mai xử lý.

Duyệt giảm giá: Bot không bao giờ hứa hoặc tự đồng ý giảm giá. Khi khách xin giảm, bot chuyển cho Chị Hà. Chị Hà quyết định trong mức được Chị Mai cho phép và báo lại khách; mức vượt phải hỏi Chị Mai.

Đơn từ 2.000.000đ trở lên cần Chị Mai duyệt trước khi gửi báo giá hoặc xác nhận cho khách.

Hoàn cọc: chỉ hoàn khi khách huỷ trước giờ hẹn ít nhất 4 tiếng; trường hợp ngoại lệ do Chị Mai quyết định.`,
  },
];

const seedSource = async (s) => {
  const found = ok(await db.from("knowledge_sources").select("id").eq("workspace_id", WS).eq("title", s.title), "source lookup");
  const pieces = chunkText(s.content);
  const vectors = await embedTexts(pieces);
  const base = {
    module: null, kind: s.kind, topic: s.topic, tags: [], visibility: s.visibility, title: s.title, content: s.content,
    status: "ready", error: vectors ? null : "Chưa tạo được vector ngữ nghĩa; vẫn tìm được theo từ khóa.", chunk_count: pieces.length, updated_at: new Date().toISOString(),
  };
  let id;
  if (found.length) {
    id = found[0].id;
    for (const extra of found.slice(1)) ok(await db.from("knowledge_sources").delete().eq("id", extra.id), "dup source");
    ok(await db.from("knowledge_chunks").delete().eq("source_id", id), "chunks delete");
    ok(await db.from("knowledge_sources").update(base).eq("id", id), "source update");
  } else {
    id = ok(await db.from("knowledge_sources").insert({ workspace_id: WS, ...base, created_by: owner.id }).select("id").single(), "source insert").id;
  }
  const rows = pieces.map((content, ord) => ({ workspace_id: WS, source_id: id, module: null, visibility: s.visibility, ord, content, embedding: vectors ? toVector(vectors[ord]) : null }));
  ok(await db.from("knowledge_chunks").insert(rows), "chunks insert");
  log(`knowledge "${s.title}" (${s.visibility}): ${pieces.length} chunk(s)${vectors ? ", embedded" : ", NO embeddings"}`);
};
for (const s of SOURCES) await seedSource(s);

/* ------------------------------------------------------------------ 5. verify */
const count = async (t, f) => (await f(db.from(t).select("*", { count: "exact", head: true }))).count;
const [inst, vers, srcs, chunks, msgs] = await Promise.all([
  count("module_installations", (q) => q.eq("workspace_id", WS)),
  count("module_context_versions", (q) => q.eq("workspace_id", WS)),
  count("knowledge_sources", (q) => q.eq("workspace_id", WS)),
  count("knowledge_chunks", (q) => q.eq("workspace_id", WS)),
  count("module_setup_messages", (q) => q.eq("workspace_id", WS)),
]);
log(`counts: installations=${inst} context_versions=${vers} setup_messages=${msgs} knowledge_sources=${srcs} knowledge_chunks=${chunks}`);
{
  const query = "combo thư giãn giá bao nhiêu";
  const qv = (await embedTexts([query]))?.[0];
  const r = await db.rpc("match_knowledge", { p_workspace: WS, p_module: "chatbot", p_query_embedding: qv ? toVector(qv) : null, p_query: query, p_limit: 8, p_audience: "customer" });
  if (r.error) { log(`match_knowledge error: ${r.error.message}`); process.exitCode = 1; }
  else {
    const biz = r.data.filter((x) => x.layer === "business");
    log(`match_knowledge(customer, "${query}"): ${biz.length} business hit(s)`);
    for (const x of biz) log(`  - [${x.visibility}] ${x.title} score=${Number(x.score).toFixed(3)}${/590\.000/.test(x.content) ? " (has the 590.000đ price)" : ""}`);
    const leak = biz.some((x) => x.visibility !== "public" || /nội bộ/i.test(x.title));
    log(leak ? "FAIL: internal passage leaked to customer audience" : "ok: no internal passage for audience customer");
    if (leak) process.exitCode = 1;
  }
}
