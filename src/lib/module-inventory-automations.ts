import "server-only";
import { after } from "next/server";
import { renderEmail } from "./email/layout";
import { sendWorkspaceEmail } from "./email/send";
import { actorOf, postOffice, type Db, type Executor, type RunCtx, type StepEx } from "./automation-runs";
import { hhmmToMinutes, vnClock } from "./automation-hours";
import type { PipelineConfig, TemplateDef } from "./automation-shared";
import type { PipelineRow } from "./automation-queries";
import { draftLowStock, requestSend, totalsOf, toItem, type ItemRow } from "./module-inventory-core";
import { formatMoney, formatQty, isPoStatus, stockStatus } from "./module-inventory-shared";

/**
 * The inventory automations (resources/automation-templates/inventory_*.json), run by the automation engine's tick:
 *   inventory_low_stock         daily: items at their reorder point get a draft purchase order per supplier; each draft waits for the owner (send_purchase_order).
 *   inventory_weekly_report     Sunday: stock value, low items, the week's movements and open orders, in Office (and by email when an address is set).
 *   inventory_supplier_overdue  daily: a sent order past its due date gets a polite reminder for the supplier, gated like any send (at most 2 per order).
 * They message nobody directly: anything that leaves goes through the send_purchase_order gate.
 */
const DAY = 86_400_000;
const num = (v: unknown): number => Number(v) || 0;

/** Ask for approval of drafted orders after the response (the message is written by OpenClaw, which takes a while); inline outside a request. */
const requestLater = async (x: RunCtx, poIds: ReadonlyArray<string>): Promise<void> => {
  const run = async () => {
    for (const id of poIds) await requestSend({ db: x.db, ws: x.ws, actor: actorOf(x.def), locale: "vi" }, id).catch((e) => console.error("inventory requestSend failed:", e instanceof Error ? e.message : e));
  };
  try {
    after(run);
  } catch {
    await run();
  }
};

const lowStock: Executor = async (x) => {
  const r = await draftLowStock(x.db, x.ws, { by: actorOf(x.def), requestApproval: false });
  if (r.lowCount === 0) return { status: "skipped", steps: [{ label: "Không có món nào sắp hết", status: "skipped", detail: "Mọi mặt hàng đều trên mức tồn tối thiểu." }] };
  const steps: Array<StepEx> = [{ label: `${r.lowCount} món sắp hết hoặc hết hàng`, status: "done" }];
  if (r.poIds.length) {
    await requestLater(x, r.poIds);
    steps.push({ label: `Đã soạn ${r.poIds.length} đơn nhập, chờ bạn duyệt`, status: "waiting", detail: "Xem trong Văn phòng hoặc tab Đơn nhập." });
    await postOffice(x.db, x.ws, `Kho: ${r.lowCount} món sắp hết. NIVO đã soạn ${r.poIds.length} đơn nhập theo nhà cung cấp, đang chờ bạn duyệt trước khi gửi.`);
    return { status: "waiting_approval", steps, evidence: `${r.lowCount} món sắp hết · ${r.poIds.length} đơn nhập` };
  }
  steps.push({ label: "Các món này đã có đơn nhập đang chờ giao", status: "done" });
  return { status: "done", steps, evidence: `${r.lowCount} món sắp hết, đã có đơn nhập` };
};

const weeklyReport: Executor = async (x) => {
  const db = x.db;
  const items = (((await db.from("inventory_items").select("*").eq("workspace_id", x.ws).eq("active", true)).data ?? []) as Array<ItemRow>).map(toItem);
  const totals = await totalsOf(db, x.ws);
  const value = items.reduce((s, i) => s + Math.max(0, totals.get(i.id) ?? 0) * i.cost_vnd, 0);
  const low = items.filter((i) => ["out", "low"].includes(stockStatus(i, totals.get(i.id) ?? 0)) && i.reorder_point > 0);
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const moves = ((await db.from("inventory_movements").select("kind, qty, unit_cost_vnd, item_id").eq("workspace_id", x.ws).gte("created_at", since)).data ?? []) as Array<{ kind: string; qty: number | string; unit_cost_vnd: number | string | null; item_id: string }>;
  const costOf = new Map(items.map((i) => [i.id, i.cost_vnd]));
  const out = moves.filter((m) => m.kind === "out").reduce((s, m) => s + Math.abs(num(m.qty)) * (costOf.get(m.item_id) ?? 0), 0);
  const inn = moves.filter((m) => m.kind === "in").reduce((s, m) => s + num(m.qty) * (num(m.unit_cost_vnd) || (costOf.get(m.item_id) ?? 0)), 0);
  const pos = ((await db.from("inventory_purchase_orders").select("po_no, status, total_vnd, expected_at, supplier:inventory_suppliers(name)").eq("workspace_id", x.ws).in("status", ["draft", "waiting_approval", "sent", "partially_received"]).order("created_at")).data ?? []) as unknown as Array<{ po_no: string; status: string; total_vnd: number | string; expected_at: string | null; supplier: { name: string } | null }>;
  const statusWord: Record<string, string> = { draft: "nháp", waiting_approval: "chờ duyệt", sent: "đã gửi", partially_received: "nhận một phần" };
  const lines = [
    `Báo cáo tồn kho tuần · ${x.shop.shop}`,
    `• Giá trị tồn kho: ${formatMoney(value)} (${items.length} mặt hàng)`,
    `• Hàng nhập trong tuần: ${formatMoney(inn)} · hàng xuất (giá vốn): ${formatMoney(out)}`,
    low.length ? `• Sắp hết (${low.length}): ${low.slice(0, 8).map((i) => `${i.name} còn ${formatQty(totals.get(i.id) ?? 0)} ${i.unit}`).join("; ")}` : "• Sắp hết: không có món nào",
    pos.length ? `• Đơn nhập đang mở (${pos.length}): ${pos.slice(0, 6).map((p) => `${p.po_no} ${p.supplier?.name ?? "chưa chọn NCC"} ${formatMoney(num(p.total_vnd))} (${statusWord[p.status] ?? p.status})`).join("; ")}` : "• Đơn nhập đang mở: không có",
  ];
  const text = lines.join("\n");
  await postOffice(db, x.ws, text);
  const steps: Array<StepEx> = [{ label: "Đã đăng báo cáo trong Văn phòng", status: "done", message: text }];
  const to = String(x.config.email ?? "").trim();
  if (to) {
    const mail = renderEmail({ shopName: x.shop.shop, title: "Báo cáo tồn kho tuần", body: text });
    const r = await sendWorkspaceEmail({ workspaceId: x.ws, to, subject: `${x.shop.shop}: báo cáo tồn kho tuần`, html: mail.html, text: mail.text, purpose: "inventory_weekly_report", audience: "owner" });
    steps.push(r.status === "sent" ? { label: `Đã gửi email tới ${to}`, status: "done" } : { label: "Chưa gửi được email", status: "skipped", detail: r.error ?? "Chưa có kết nối email." });
  }
  return { status: "done", steps, evidence: `Giá trị tồn ${formatMoney(value)} · sắp hết ${low.length} · đơn mở ${pos.length}` };
};

const overdue: Executor = async (x, p) => {
  const poId = String(p.po_id ?? "");
  const po = ((await x.db.from("inventory_purchase_orders").select("id, po_no, status, reminders, expected_at, supplier:inventory_suppliers(name)").eq("workspace_id", x.ws).eq("id", poId).maybeSingle()).data ?? null) as unknown as
    { id: string; po_no: string; status: string; reminders: number; expected_at: string | null; supplier: { name: string } | null } | null;
  if (!po || !isPoStatus(po.status) || (po.status !== "sent" && po.status !== "partially_received")) return { status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail: "Đơn này đã nhận đủ hoặc đã huỷ." }] };
  const who = po.supplier?.name ?? "nhà cung cấp";
  await postOffice(x.db, x.ws, `Đơn nhập ${po.po_no} của ${who} đã quá hạn giao${po.expected_at ? ` (hẹn ${po.expected_at.split("-").reverse().join("/")})` : ""}. NIVO soạn tin nhắc nhẹ, chờ bạn duyệt.`);
  const res = await requestSend({ db: x.db, ws: x.ws, actor: actorOf(x.def), locale: "vi" }, po.id, { kind: "reminder" });
  const waiting = res.status === "waiting_decision";
  return {
    status: waiting ? "waiting_approval" : "done",
    steps: [{ label: waiting ? "Đã soạn tin nhắc, chờ bạn duyệt" : "Đã nhắc nhà cung cấp", status: waiting ? "waiting" : "done", workItemId: res.workItemId ?? undefined }],
    evidence: `Nhắc lần ${po.reminders + 1} · ${po.po_no}`,
  };
};

export const INVENTORY_EXECUTORS: Readonly<Record<string, Executor>> = {
  inventory_low_stock: lowStock, inventory_weekly_report: weeklyReport, inventory_supplier_overdue: overdue,
};

/** The scan of an inventory template (called from the automation tick for a pipeline of the inventory module): decides what is due now and starts it. */
export const scanInventory = async (
  db: Db, l: { readonly p: PipelineRow; readonly def: TemplateDef; readonly config: PipelineConfig }, now: Date,
  fire: (dedupe: string, ref: string, payload: Record<string, unknown>) => Promise<void>,
): Promise<number> => {
  const clock = vnClock(now);
  if (clock.minute < hhmmToMinutes(String(l.config.time))) return 0;
  const key = l.def.key;
  if (key === "inventory_low_stock") {
    await fire(`inv-low:${clock.day}`, clock.day, { day: clock.day });
    return 1;
  }
  if (key === "inventory_weekly_report") {
    if (new Date(`${clock.day}T12:00:00+07:00`).getUTCDay() !== 0) return 0;
    await fire(`inv-week:${clock.day}`, clock.day, { day: clock.day });
    return 1;
  }
  if (key === "inventory_supplier_overdue") {
    const grace = Math.max(0, Number(l.config.graceDays) || 0);
    const cutoff = new Date(now.getTime() - grace * DAY).toISOString().slice(0, 10);
    const rows = ((await db.from("inventory_purchase_orders").select("id, reminders, updated_at, expected_at").eq("workspace_id", l.p.workspace_id).in("status", ["sent", "partially_received"]).not("expected_at", "is", null).lt("expected_at", cutoff).lt("reminders", 2).limit(20)).data ?? []) as Array<{ id: string; reminders: number; updated_at: string }>;
    let started = 0;
    for (const po of rows) {
      if (po.reminders > 0 && now.getTime() - Date.parse(po.updated_at) < 2 * DAY) continue;
      await fire(`inv-overdue:${po.id}:${po.reminders + 1}`, po.id, { po_id: po.id });
      started += 1;
    }
    return started;
  }
  return 0;
};
