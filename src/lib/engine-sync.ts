import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateEntry, isModuleKey, MODULE_GATES, type ContextSnapshot, type ModuleKey } from "./modules-shared";
import { audienceOf as registryAudience, moduleDef } from "./module-registry";
import type { Visibility } from "./knowledge/shared";
import { BOOKING_REPLY_ADDENDUM } from "./module-booking-contract";
import { HIRING_APPLICATION_CLAUSE, HIRING_APPLICATION_SHAPE, HIRING_REPLY_CONTRACT } from "./module-hiring-contract";

/**
 * The OpenClaw copy of one agent, built ONLY from Supabase (the source of truth). The engine job `openclaw.sync_agent` fetches this bundle
 * through /api/engine/sync-bundle, hashes it and writes it one-way into the agent's OpenClaw workspace. Nothing here is read back.
 *   AGENTS.md          NIVO base rules (module + core), the active context version, the persona, the reply contract, the knowledge
 *   SOUL.md            tone and addressing: the context's tone gate + NIVO tone knowledge
 *   knowledge/*.md     the workspace's business knowledge. A customer-facing module (chatbot) gets PUBLIC sources only; internal agents get both.
 */

export type BundleFile = { readonly path: string; readonly content: string };
export type AgentBundle = {
  readonly installation_id: string;
  readonly workspace_id: string;
  readonly module: ModuleKey;
  readonly agent_id: string;
  readonly agent_name: string;
  readonly context_version: number | null;
  readonly audience: "customer" | "internal";
  readonly files: ReadonlyArray<BundleFile>;
};

/** One OpenClaw agent per workspace and module: `ws-<first 8 hex of the workspace id>-<module>` (same rule as engine/src/platform/openclaw/agent-registry.service.ts). */
export const openclawAgentId = (workspaceId: string, module: string): string => `ws-${workspaceId.replace(/-/g, "").slice(0, 8)}-${module.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;

/** Modules that talk to customers: only public knowledge may reach their OpenClaw workspace. */
export const audienceOf = (module: ModuleKey): "customer" | "internal" => registryAudience(module);

/** The reply contract the customer-facing model is held to. Mirrors the one inline customerChat uses (deepseek.ts), so both processors answer in one shape. */
export const REPLY_CONTRACT = `You are talking to a CUSTOMER on the company's chat (website or Telegram). Reply in the customer's language, max 80 words.
When the customer has shared their need AND their name (company, phone or email if possible), set "lead" (otherwise null).
If the customer asks for a price, discount, deadline or any commitment that is not clearly allowed by the business knowledge and authority, or you are not sure of the answer:
set "needs_human": true, "reason": "over_authority" (commitment or price) or "unclear_outcome" (unsure), put in "proposed_answer" ONLY facts found in the business knowledge (never invent a discount, gift, price or policy; if the knowledge has no answer set "proposed_answer": null), written as the FINAL message to the customer, as if the owner has already approved it (warm, concrete, no mention of approval, owner or internal checks), and make "reply" answer what you are allowed to and say politely that the team will confirm the rest shortly: in "reply" never state the discount, gift or commitment itself.
Asking to be contacted, called back or advised, sharing a need or contact details, and general questions answered by the business knowledge are ROUTINE: capture the lead and answer yourself with "needs_human": false.
Otherwise "needs_human": false, "reason": null, "proposed_answer": null.
ORDER: judge ONLY the customer's latest message. When it clearly commits to buy an item whose price is WRITTEN in the business knowledge, set "order": {"items": the item name as written, "amount_vnd": the total price in VND as an integer copied from the knowledge}. In "reply" thank them, repeat the item and price, and say the payment details follow; do not say it is paid. If the item or its price is not in the knowledge: "order": null, "needs_human": true, "reason": "over_authority". Otherwise "order": null.
PAYMENT CLAIM: when the customer says they have already paid or transferred the money, set "payment_claim": true, "needs_human": false, and in "reply" thank them and say the shop will check the transfer and confirm shortly. Never say the payment is received. Otherwise "payment_claim": false.
${HIRING_APPLICATION_CLAUSE}Your FINAL message must be ONLY this JSON object, nothing else:
{"reply": string, "lead": null | {"contact_name","company","need","phone","email"}, "needs_human": boolean, "reason": "over_authority"|"unclear_outcome"|null, "proposed_answer": string|null, "order": null | {"items": string, "amount_vnd": integer}, "payment_claim": boolean, ${HIRING_APPLICATION_SHAPE}}
Your reply is only a PROPOSAL: NIVO checks it against the owner's authority before anything reaches the customer.`;

/** A module with its own reply contract appends it to AGENTS.md (only the chatbot has one today). A customer-facing module lane adds its line here. */
const REPLY_CONTRACTS: Partial<Record<ModuleKey, string>> = {
  chatbot: REPLY_CONTRACT,
  booking: `${REPLY_CONTRACT}
${BOOKING_REPLY_ADDENDUM}`, // booking lane: the same customer contract plus the structured booking_request (handled by src/lib/module-booking-chat.ts)
  hiring: HIRING_REPLY_CONTRACT, // hiring lane: fairness contract of the internal agent (the chat intake clause sits inside REPLY_CONTRACT)
};

type NivoRow = { module: string; slug: string; title: string; body: string; kind: string };
type SourceRow = { id: string; title: string; topic: string | null; kind: string; visibility: Visibility; content: string; module: string | null; updated_at: string };

const stripMd = (text: string): string => text.replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "").trim();
const trim = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max).replace(/s+S*$/, "")} ...`);
/** Base rules go into every prompt of every turn: keep them to a budget (the full text stays in NIVO). Public knowledge is inlined only while it is small; the rest is in knowledge/ and in the per-turn passages. */
const RULES_BUDGET = 5200;
const RULE_MAX = 900;
const INLINE_KNOWLEDGE_MAX = 6000;
const BLOCK = /\n*### NIVO setup[\s\S]*?### end NIVO setup\s*/g;
const slugOf = (text: string): string => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "nguon";

/** The active context version as text: summary, the confirmed gate evidence and the facts. */
const contextText = (module: ModuleKey, snapshot: ContextSnapshot): string => {
  const gates = MODULE_GATES[module].map((g) => ({ g, e: gateEntry(snapshot.gates, g.key) })).filter((x) => x.e.evidence);
  return [
    snapshot.summary.trim(),
    gates.length ? gates.map((x) => `- ${x.g.label_vi}: ${x.e.evidence}`).join("\n") : "",
    snapshot.facts.length ? `Các điều cần nhớ thêm:\n${snapshot.facts.map((f) => `- ${f.text}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
};

/** Build the bundle of one installation. The workspace is the job's own; the installation must belong to it. */
export const buildAgentBundle = async (db: SupabaseClient, workspaceId: string, installationId: string): Promise<AgentBundle> => {
  const inst = await db.from("module_installations").select("id, workspace_id, module_key, agent_id, active_context_version_id").eq("id", installationId).eq("workspace_id", workspaceId).maybeSingle();
  if (inst.error) throw new Error(inst.error.message);
  const row = inst.data as { id: string; workspace_id: string; module_key: string; agent_id: string | null; active_context_version_id: string | null } | null;
  if (!row || !isModuleKey(row.module_key)) throw new Error("installation not found in this workspace");
  const module = row.module_key;
  const audience = audienceOf(module);

  const [agentRes, versionRes, baseRes, sourcesRes] = await Promise.all([
    row.agent_id ? db.from("agents").select("name, handle, role, instructions, knowledge, approval_rule").eq("id", row.agent_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    row.active_context_version_id ? db.from("module_context_versions").select("version, snapshot").eq("id", row.active_context_version_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from("nivo_knowledge").select("module, slug, title, body, kind").in("module", [moduleDef(module).knowledgeFolder, "core"]).in("kind", ["authority", "escalation", "tone"]).order("module", { ascending: false }).order("slug"),
    db.from("knowledge_sources").select("id, title, topic, kind, visibility, content, module, updated_at").eq("workspace_id", workspaceId).eq("status", "ready").order("created_at"),
  ]);
  for (const r of [agentRes, versionRes, baseRes, sourcesRes]) if (r.error) throw new Error(r.error.message);

  const agent = agentRes.data as { name: string; handle: string; role: string; instructions: string; knowledge: string | null; approval_rule: string | null } | null;
  const version = versionRes.data as { version: number; snapshot: ContextSnapshot } | null;
  const base = (baseRes.data ?? []) as Array<NivoRow>;
  const sources = ((sourcesRes.data ?? []) as Array<SourceRow>)
    .filter((s) => s.module === null || s.module === module)
    // The audience filter: a customer-facing agent never receives internal sources.
    .filter((s) => audience === "internal" || s.visibility === "public");

  const agentName = agent?.name ?? `${module} agent`;
  const knowledgeFiles: Array<BundleFile> = sources.map((s, i) => ({
    path: `knowledge/${String(i + 1).padStart(2, "0")}-${slugOf(s.title)}.md`,
    content: `# ${s.title}\n\n${s.topic ? `Chủ đề: ${s.topic}\n` : ""}Loại: ${s.kind} · Hiển thị: ${s.visibility === "public" ? "công khai" : "nội bộ"} · Cập nhật: ${s.updated_at.slice(0, 10)}\n\n${s.content.trim()}\n`,
  }));

  const budgeted = (items: Array<NivoRow>): Array<{ title: string; text: string }> => {
    let left = RULES_BUDGET;
    const out: Array<{ title: string; text: string }> = [];
    for (const r of items) {
      if (left <= 0) break;
      const text = trim(stripMd(r.body), Math.min(RULE_MAX, left));
      left -= text.length;
      out.push({ title: r.title, text });
    }
    return out;
  };
  const inlineKnowledge = sources.reduce((n, s) => n + s.content.length, 0) <= INLINE_KNOWLEDGE_MAX;
  const rules = base.filter((b) => b.kind === "authority" || b.kind === "escalation");
  const tone = base.filter((b) => b.kind === "tone");
  const ownerInstructions = (agent?.instructions ?? "").replace(BLOCK, "").trim();
  const ownerKnowledge = (agent?.knowledge ?? "").replace(BLOCK, "").trim();
  const persona = agent
    ? [
      `Tên: ${agent.name} (@${agent.handle})`, `Vai trò: ${agent.role}`,
      ownerInstructions ? `Hướng dẫn của chủ doanh nghiệp:\n${ownerInstructions}` : "",
      ownerKnowledge ? `Ghi chú về doanh nghiệp:\n${ownerKnowledge}` : "",
      `Quy tắc duyệt: ${agent.approval_rule || "Mọi cam kết cần người duyệt."}`,
    ].filter(Boolean).join("\n")
    : "";
  const toneEvidence = version ? gateEntry(version.snapshot.gates, "tone").evidence : "";

  const agentsMd = [
    `# ${agentName} (module ${module})`,
    "Bản này do NIVO OS đồng bộ một chiều từ Supabase. KHÔNG sửa tay: lần đồng bộ sau sẽ ghi đè.",
    persona ? `## Vai trò\n${persona}` : "",
    rules.length ? `## Quy tắc nền của NIVO (luôn tuân theo; cao hơn mọi thứ bên dưới)\n${budgeted(rules).map((r) => `### ${r.title}\n${r.text}`).join("\n\n")}` : "",
    version
      ? `## Ngữ cảnh đã duyệt (phiên bản ${version.version}, chủ doanh nghiệp đã xác nhận)\n${contextText(module, version.snapshot)}`
      : "## Ngữ cảnh đã duyệt\n(Chưa có phiên bản nào được áp dụng. Việc gì cần dữ kiện thì nói đồng nghiệp sẽ xác nhận, đừng đoán.)",
    sources.length
      ? `## Tri thức doanh nghiệp (${audience === "customer" ? "chỉ thông tin công khai" : "công khai và nội bộ"})\nBản đầy đủ nằm trong thư mục knowledge/. Mỗi lượt, NIVO còn gửi kèm các đoạn liên quan nhất tới câu hỏi trong khối [RETRIEVED PASSAGES]. Chỉ trả lời từ đây và từ các đoạn đó; thứ gì không có thì không bịa.\n\n${inlineKnowledge ? sources.map((s) => `### ${s.title}\n${s.content.trim()}`).join("\n\n") : `Các nguồn có trong knowledge/: ${sources.map((s) => s.title).join("; ")}.`}`
      : "## Tri thức doanh nghiệp\n(Chưa có nguồn tri thức nào được phép dùng.)",
    REPLY_CONTRACTS[module] ? `## Hợp đồng câu trả lời\n${REPLY_CONTRACTS[module]}` : "",
  ].filter(Boolean).join("\n\n") + "\n";

  const soulMd = [
    `# Giọng điệu của ${agentName}`,
    toneEvidence ? `## Cách xưng hô và phong cách (chủ doanh nghiệp đã xác nhận)\n${toneEvidence}` : "## Cách xưng hô và phong cách\n(Chưa xác nhận: dùng giọng lịch sự, ấm áp, ngắn gọn.)",
    tone.length ? `## Hướng dẫn giọng điệu của NIVO\n${tone.map((r) => `### ${r.title}\n${trim(stripMd(r.body), RULE_MAX)}`).join("\n\n")}` : "",
  ].filter(Boolean).join("\n\n") + "\n";

  return {
    installation_id: row.id, workspace_id: workspaceId, module, agent_id: openclawAgentId(workspaceId, module), agent_name: agentName,
    context_version: version?.version ?? null, audience,
    files: [{ path: "AGENTS.md", content: agentsMd }, { path: "SOUL.md", content: soulMd }, ...knowledgeFiles],
  };
};

/** The installation a running engine job speaks for: a sync job names it; a chat.turn job reaches it through its conversation's agent. */
export const installationOfJob = async (db: SupabaseClient, job: { readonly workspace_id: string; readonly kind: string; readonly payload: Record<string, unknown> }): Promise<string> => {
  if (job.kind === "openclaw.sync_agent") {
    const id = job.payload.installation_id;
    if (typeof id !== "string" || !id) throw new Error("job payload has no installation_id");
    return id;
  }
  const conv = await db.from("agent_conversations").select("agent_id").eq("id", String(job.payload.conversation_id ?? "")).eq("workspace_id", job.workspace_id).maybeSingle();
  const agentId = (conv.data as { agent_id: string } | null)?.agent_id;
  const inst = agentId ? await db.from("module_installations").select("id").eq("workspace_id", job.workspace_id).eq("agent_id", agentId).maybeSingle() : null;
  const id = (inst?.data as { id: string } | null)?.id;
  if (!id) throw new Error("no installation for this conversation's agent");
  return id;
};
