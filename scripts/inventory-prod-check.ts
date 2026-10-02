// Production check of the Kho & nhập hàng module. Needs the service role; runs the REAL app code (src/lib/module-inventory-*, the engine and its gate)
// against the production database with test data in the workspaces "Kiểm thử · Quán cà phê" and "Kiểm thử · Cửa hàng vật liệu".
//   node scripts/with-secrets.mjs npx tsx --conditions=react-server scripts/inventory-prod-check.ts [cafe|building|tick|all] [--reset]
// It prints PASS/FAIL per check and never prints a secret. Nothing is sent to a real supplier: the test workspaces have no SMTP connection.
import { createHmac } from "node:crypto";
import { installModuleCore } from "../src/lib/module-install";
import { ensureFlowDefaults } from "../src/lib/flow-seed";
import { resumeWork, runWork, type EngineCtx } from "../src/lib/engine";
import { admin, applyMovement, deductForOrder, defaultLocation, totalsOf } from "../src/lib/module-inventory-core";
import { adjustStock, importPasted, loadTemplate, receivePo, stockTake } from "../src/lib/module-inventory-ops";
import { INVENTORY_EXECUTORS } from "../src/lib/module-inventory-automations";
import { tickKey } from "../src/lib/automation-tick";
import { vnClock } from "../src/lib/automation-hours";

const CAFE = "Kiểm thử · Quán cà phê";
const BUILDING = "Kiểm thử · Cửa hàng vật liệu";
const BUILDING_ID = "a6f076a7-de08-4d20-bba5-5f6cdd791b6a";
const db = admin();
let failed = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  if (!cond) failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  [${detail}]` : ""}`);
};
const num = (v: unknown) => Number(v) || 0;
const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith("--")) ?? "all";
const reset = args.includes("--reset");

const wipe = async (ws: string): Promise<void> => {
  for (const t of ["inventory_receipts", "inventory_po_lines", "inventory_purchase_orders", "inventory_recipe_lines", "inventory_recipes", "inventory_movements", "inventory_stock_levels", "inventory_items", "inventory_suppliers", "inventory_locations"]) {
    await db.from(t).delete().eq("workspace_id", ws);
  }
  await db.from("work_items").delete().eq("workspace_id", ws).eq("department", "inventory");
  await db.from("automation_pipelines").delete().eq("workspace_id", ws).like("template_key", "inventory_%");
};

const workspace = async (name: string, id?: string): Promise<string> => {
  const q = id ? db.from("workspaces").select("id").eq("id", id) : db.from("workspaces").select("id").eq("name", name);
  const found = ((await q.limit(1)).data ?? [])[0] as { id: string } | undefined;
  if (found) return found.id;
  const users = (await db.auth.admin.listUsers({ perPage: 200 })).data?.users ?? [];
  const owner = users.find((u) => u.email === process.env.READY_OWNER_EMAIL) ?? users[0];
  const ins = await db.from("workspaces").insert({ name, owner_id: owner.id }).select("id").single();
  if (ins.error) throw new Error(`workspace: ${ins.error.message}`);
  console.log("created workspace", name);
  return (ins.data as { id: string }).id;
};

const ctxOf = (ws: string): EngineCtx => ({ db, ws, actor: "Kiểm thử", locale: "vi" });
const itemBySku = async (ws: string, sku: string) => (await db.from("inventory_items").select("*").eq("workspace_id", ws).eq("sku", sku).single()).data as Record<string, unknown>;
const totalOf = async (ws: string, itemId: string) => (await totalsOf(db, ws, [itemId])).get(itemId) ?? 0;

const prepare = async (ws: string, templateKey: string): Promise<void> => {
  if (reset) await wipe(ws);
  await ensureFlowDefaults(db, ws, "Kiểm thử", "vi");
  const inst = await installModuleCore(db, { workspaceId: ws, moduleKey: "inventory", locale: "vi", actorName: "Kiểm thử" });
  ok("module inventory installed (authority rules seeded)", Boolean(inst.installationId));
  const rules = ((await db.from("authority_rules").select("action, mode").eq("workspace_id", ws).eq("department", "inventory")).data ?? []) as Array<{ action: string; mode: string }>;
  const mode = (a: string) => rules.find((r) => r.action === a)?.mode;
  ok("rules: draft_purchase_order=auto, send_purchase_order=ask, adjust_stock=ask", mode("draft_purchase_order") === "auto" && mode("send_purchase_order") === "ask" && mode("adjust_stock") === "ask", JSON.stringify(rules.map((r) => `${r.action}:${r.mode}`)));
  const t = await loadTemplate(ctxOf(ws), templateKey);
  console.log("template loaded", t);
};

const confirmOrder = async (ws: string, items: string, amount: number, no: string): Promise<string> => {
  const lead = (await db.from("leads").insert({ workspace_id: ws, contact_name: "Kiểm thử khách lẻ", company: "—", channel: "manual", need: items, origin: "simulated" }).select("id").single()).data as { id: string };
  const order = (await db.from("orders").insert({ workspace_id: ws, lead_id: lead.id, order_no: no, items, amount_vnd: amount, status: "draft", origin: "simulated" }).select("id").single()).data as { id: string };
  const w = await runWork(ctxOf(ws), {
    action: "confirm_order", subject_type: "order", subject_id: order.id, lead_id: lead.id, dedupeKey: `confirm_order:order:${order.id}`, origin: "simulated", preset: true, noChain: true,
    seed: { summary: `Kiểm thử đơn ${no}`, amount_vnd: amount, fields: { items, amount_vnd: amount, customer: "Kiểm thử khách lẻ", order_no: no } },
  });
  ok(`order ${no} confirmed through the Sales gate`, w.status === "done", w.status);
  return order.id;
};

/* ------------------------------------------------------------------ café */
const cafe = async (): Promise<void> => {
  console.log("\n== Kiểm thử · Quán cà phê ==");
  const ws = await workspace(CAFE);
  await prepare(ws, "cafe");
  const items = ((await db.from("inventory_items").select("id, sku").eq("workspace_id", ws)).data ?? []).length;
  const sups = ((await db.from("inventory_suppliers").select("id").eq("workspace_id", ws)).data ?? []).length;
  const recs = ((await db.from("inventory_recipes").select("id").eq("workspace_id", ws)).data ?? []).length;
  ok("café data: 8 items incl. ingredients, 1 recipe, 2 suppliers", items === 8 && recs === 1 && sups === 2, `${items} items, ${recs} recipe, ${sups} suppliers`);
  await db.from("inventory_suppliers").update({ email: "kiem-thu.phuloc@example.com" }).eq("workspace_id", ws).like("name", "%Phú Lộc%");

  // Put the coffee near its reorder point (set-up only), then a small and a big manual adjustment through the gate.
  const cf = await itemBySku(ws, "CF-HAT");
  const cfId = cf.id as string;
  const now0 = await totalOf(ws, cfId);
  if (now0 !== 2300) await applyMovement(db, ws, { itemId: cfId, kind: "adjust", delta: 2300 - now0, reason: "Kiểm thử: đặt tồn gần mức tối thiểu", by: "Kiểm thử" });
  const small = await adjustStock(ctxOf(ws), { itemId: cfId, delta: -100, reason: "Kiểm thử: hao hụt nhỏ" });
  ok("small adjustment (-100 g) applied at once", small.state === "applied" && (await totalOf(ws, cfId)) === 2200);
  const big = await adjustStock(ctxOf(ws), { itemId: cfId, delta: -1000, reason: "Kiểm thử: hao hụt lớn" });
  ok("big adjustment (-1000 g, 250.000 ₫) waits for approval (adjust_stock = ask)", big.state === "waiting" && (await totalOf(ws, cfId)) === 2200, big.state);
  if (big.state === "waiting") {
    await resumeWork(ctxOf(ws), big.workItemId, "approved", {}, { name: "Kiểm thử (chủ)", kind: "owner" });
    ok("approved adjustment is applied (2200 → 1200)", (await totalOf(ws, cfId)) === 1200);
    await applyMovement(db, ws, { itemId: cfId, kind: "adjust", delta: 1100, reason: "Kiểm thử: trả lại 2300 g", by: "Kiểm thử" });
  }

  // A confirmed order of 25 cà phê sữa takes the recipe's ingredients out of stock.
  const before = await totalOf(ws, cfId);
  const orderId = await confirmOrder(ws, "25 cà phê sữa", 1_375_000, `KT-CAFE-${Date.now().toString().slice(-6)}`);
  const sku = async (s: string) => totalOf(ws, (await itemBySku(ws, s)).id as string);
  ok("order deducted 500 g coffee (20 g × 25)", (await totalOf(ws, cfId)) === before - 500, `${before} → ${await totalOf(ws, cfId)}`);
  ok("order deducted 750 ml condensed milk (30 ml × 25)", (await sku("SUA-DAC")) === 4000 - 750);
  ok("order deducted 25 cups, 25 lids, 25 straws", (await sku("LY-NHUA")) === 575 && (await sku("NAP-LY")) === 575 && (await sku("ONG-HUT")) === 575);
  const again = await deductForOrder(db, ws, { orderId, orderNo: "dup", items: "25 cà phê sữa" });
  ok("the same order never deducts twice (idempotent)", again.deducted.length === 0 && (await totalOf(ws, cfId)) === before - 500);

  // Low stock → draft PO → gate waiting.
  const po = ((await db.from("inventory_purchase_orders").select("*").eq("workspace_id", ws).order("created_at", { ascending: false })).data ?? []) as Array<Record<string, unknown>>;
  const mine = po.find((p) => p.status === "waiting_approval") ?? po[0];
  ok("low stock drafted a purchase order for the usual supplier", Boolean(mine) && mine.source === "auto", mine ? `${mine.po_no} ${mine.status}` : "none");
  if (!mine) return;
  const lines = ((await db.from("inventory_po_lines").select("item_id, qty_ordered").eq("po_id", mine.id as string)).data ?? []) as Array<{ item_id: string; qty_ordered: number }>;
  ok("draft has the coffee line with the usual order quantity (10000 g)", lines.some((l) => l.item_id === cfId && num(l.qty_ordered) === 10000));
  ok("PO is waiting_approval and carries a message for the supplier", mine.status === "waiting_approval" && String(mine.message).length > 30, `${String(mine.message).length} chars`);
  const wi = ((await db.from("work_items").select("*").eq("workspace_id", ws).eq("action", "send_purchase_order").eq("subject_id", mine.id as string)).data ?? [])[0] as Record<string, unknown> | undefined;
  ok("send_purchase_order is a waiting decision (gate = ask)", wi?.status === "waiting_decision", String(wi?.status));
  const gen = ((await db.from("ai_generations").select("status, purpose").eq("workspace_id", ws).eq("purpose", "inventory_po_message").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as { status: string } | undefined;
  console.log(`INFO  order message written by OpenClaw: ${gen ? gen.status : "no generation row (fallback template used)"}`);

  // Approve → sent (email attempt fell back to the copy-ready message: no SMTP in the test workspace).
  if (wi) {
    const done = await resumeWork(ctxOf(ws), wi.id as string, "approved", {}, { name: "Kiểm thử (chủ)", kind: "owner" });
    const sent = (await db.from("inventory_purchase_orders").select("status, sent_via, send_note, sent_at").eq("id", mine.id as string).single()).data as Record<string, unknown>;
    ok("approval → PO status sent", done.status === "done" && sent.status === "sent", `${sent.status} via ${sent.sent_via}`);
    ok("email attempted, no SMTP → copy-ready message kept (honest, not claimed as emailed)", sent.sent_via === "copy" && Boolean(sent.send_note), String(sent.send_note));
    const mails = ((await db.from("email_messages").select("status, purpose").eq("workspace_id", ws).eq("purpose", "inventory_po")).data ?? []) as Array<{ status: string }>;
    ok("the email attempt is recorded in email_messages", mails.length > 0, mails.map((m) => m.status).join(","));
  }

  // Partial receive at a higher price → weighted average cost.
  const poFull = ((await db.from("inventory_po_lines").select("id, item_id, qty_ordered").eq("po_id", mine.id as string)).data ?? []) as Array<{ id: string; item_id: string; qty_ordered: number }>;
  const cfLine = poFull.find((l) => l.item_id === cfId);
  if (cfLine) {
    const stockBefore = await totalOf(ws, cfId);
    const costBefore = num((await itemBySku(ws, "CF-HAT")).cost_vnd);
    const r = await receivePo(ctxOf(ws), { poId: mine.id as string, invoiceNo: "KT-HD-001", lines: [{ lineId: cfLine.id, qty: 6000, unitCost: 270 }] });
    const costAfter = num((await itemBySku(ws, "CF-HAT")).cost_vnd);
    const expected = Math.round(((stockBefore * costBefore + 6000 * 270) / (stockBefore + 6000)) * 100) / 100;
    ok("partial receive → partially_received, +6000 g", r.status === "partially_received" && (await totalOf(ws, cfId)) === stockBefore + 6000, r.status);
    ok("price change noticed (250 → 270)", r.priceChanges.length === 1, r.priceChanges.join("; "));
    ok("cost moved to the weighted average", Math.abs(costAfter - expected) < 0.01, `${costBefore} → ${costAfter} (expected ${expected})`);
    const mv = ((await db.from("inventory_movements").select("kind, qty, unit_cost_vnd, ref_label").eq("item_id", cfId).eq("kind", "in").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as Record<string, unknown> | undefined;
    ok("receipt recorded as an 'in' movement with the actual price and PO reference", num(mv?.qty) === 6000 && num(mv?.unit_cost_vnd) === 270 && Boolean(mv?.ref_label));
  }

  // Overdue reminder through the SIGNED tick of the deployed app.
  await db.from("inventory_purchase_orders").update({ expected_at: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10) }).eq("id", mine.id as string);
  for (const [key, config] of [["inventory_low_stock", { time: "00:00" }], ["inventory_weekly_report", { time: "00:00", email: "" }], ["inventory_supplier_overdue", { time: "00:00", graceDays: 0 }]] as const) {
    const names: Record<string, string> = { inventory_low_stock: "Cảnh báo sắp hết hàng", inventory_weekly_report: "Báo cáo tồn kho cuối tuần", inventory_supplier_overdue: "Nhắc nhà cung cấp giao trễ" };
    await db.from("automation_pipelines").upsert({ workspace_id: ws, template_key: key, name: names[key], module_key: "inventory", enabled: true, config }, { onConflict: "workspace_id,template_key" });
  }
  await tick();
  const runs = ((await db.from("automation_runs").select("status, dedupe_key, steps, evidence, pipeline:automation_pipelines(template_key)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(10)).data ?? []) as unknown as Array<{ status: string; dedupe_key: string; evidence: string | null; pipeline: { template_key: string } | null }>;
  const run = (k: string) => runs.find((r) => r.pipeline?.template_key === k);
  ok("daily low-stock automation ran on the tick", Boolean(run("inventory_low_stock")), `${run("inventory_low_stock")?.status} ${run("inventory_low_stock")?.evidence ?? ""}`);
  ok("overdue automation ran and asked approval for a supplier reminder", run("inventory_supplier_overdue")?.status === "waiting_approval", `${run("inventory_supplier_overdue")?.status} ${run("inventory_supplier_overdue")?.evidence ?? ""}`);
  const weekday = new Date(`${vnClock().day}T12:00:00+07:00`).getUTCDay();
  console.log(`INFO  weekly report scan fires on Sundays only (today weekday ${weekday}); run: ${run("inventory_weekly_report")?.status ?? "not due"}`);

  // The weekly report executor itself (real code, real data), whatever the weekday.
  const pipeline = ((await db.from("automation_pipelines").select("*").eq("workspace_id", ws).eq("template_key", "inventory_weekly_report").single()).data ?? {}) as never;
  const res = await INVENTORY_EXECUTORS.inventory_weekly_report(
    { db, ws, pipeline, def: { name: { vi: "Báo cáo tồn kho cuối tuần" } } as never, config: { time: "00:00", email: "" }, body: "", shop: { shop: CAFE, hours: "", hoursRange: null } }, {},
  );
  ok("weekly report executor produced the report", res.status === "done", res.evidence ?? "");

  // Receive the rest → received.
  const left = ((await db.from("inventory_po_lines").select("id, qty_ordered, qty_received").eq("po_id", mine.id as string)).data ?? []) as Array<{ id: string; qty_ordered: number; qty_received: number }>;
  const r2 = await receivePo(ctxOf(ws), { poId: mine.id as string, lines: left.filter((l) => num(l.qty_ordered) > num(l.qty_received)).map((l) => ({ lineId: l.id, qty: num(l.qty_ordered) - num(l.qty_received), unitCost: 270 })) });
  ok("receiving the rest → received", r2.status === "received", r2.status);
};

/* ------------------------------------------------------------------ building materials */
const building = async (): Promise<void> => {
  console.log("\n== Kiểm thử · Cửa hàng vật liệu ==");
  const ws = await workspace(BUILDING, BUILDING_ID);
  await prepare(ws, "building");
  await installModuleCore(db, { workspaceId: ws, moduleKey: "accounting", locale: "vi", actorName: "Kiểm thử" });
  const xm = await itemBySku(ws, "XM-PCB40");
  const xmBefore = await totalOf(ws, xm.id as string);
  await confirmOrder(ws, "2 tấn xi măng PCB40, 3 m3 cát xây tô, 100 viên gạch ống, 1 cây khoan bê tông", 9_500_000, `KT-VLXD-${Date.now().toString().slice(-6)}`);
  ok("2 tấn xi măng = 40 bao (unit conversion)", (await totalOf(ws, xm.id as string)) === xmBefore - 40, `${xmBefore} → ${await totalOf(ws, xm.id as string)}`);
  const unmatched = ((await db.from("messages").select("body").eq("workspace_id", ws).like("body", "%chưa khớp hàng%").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as { body: string } | undefined;
  ok("a line that matches nothing is reported in Office, not guessed", Boolean(unmatched?.body.includes("khoan")), unmatched?.body.slice(0, 90));

  // Bricks by the truck: 5 xe = 15000 > stock → out of stock → PO for the phone supplier → copy-ready message.
  await confirmOrder(ws, "5 xe gạch ống", 8_000_000, `KT-VLXD-${Date.now().toString().slice(-6)}b`);
  const brick = await itemBySku(ws, "GACH-ONG");
  ok("bricks went out of stock (negative is shown, not hidden)", (await totalOf(ws, brick.id as string)) < 0, String(await totalOf(ws, brick.id as string)));
  const po = ((await db.from("inventory_purchase_orders").select("*, supplier:inventory_suppliers(name, channel)").eq("workspace_id", ws).eq("status", "waiting_approval").order("created_at", { ascending: false })).data ?? []) as Array<Record<string, unknown>>;
  const brickPo = po.find((p) => (p.supplier as { channel: string } | null)?.channel === "phone");
  ok("PO for the phone/Zalo supplier waits with a copy-ready message", Boolean(brickPo) && String(brickPo?.message).length > 20, brickPo ? String(brickPo.po_no) : "none");
  if (brickPo) {
    const wi = ((await db.from("work_items").select("id").eq("workspace_id", ws).eq("subject_id", brickPo.id as string).eq("action", "send_purchase_order")).data ?? [])[0] as { id: string };
    await resumeWork(ctxOf(ws), wi.id, "approved", {}, { name: "Kiểm thử (chủ)", kind: "owner" });
    const sent = (await db.from("inventory_purchase_orders").select("status, sent_via, send_note").eq("id", brickPo.id as string).single()).data as Record<string, unknown>;
    ok("approved → sent with the message kept to copy for a phone/Zalo supplier", sent.status === "sent" && sent.sent_via === "copy", String(sent.send_note));
    const lines = ((await db.from("inventory_po_lines").select("id, qty_ordered").eq("po_id", brickPo.id as string)).data ?? []) as Array<{ id: string; qty_ordered: number }>;
    const r = await receivePo(ctxOf(ws), { poId: brickPo.id as string, invoiceNo: "KT-NCC-778", lines: lines.map((l) => ({ lineId: l.id, qty: num(l.qty_ordered), unitCost: 1300 })) });
    ok("full receive with a supplier invoice is handed to Accounting as a payable", r.status === "received" && r.handedToAccounting && r.payableVnd > 0, `${r.payableVnd} ₫`);
  }

  // Paste import + stock-take.
  const imp = await importPasted(ctxOf(ws), "Tên\tĐơn vị\tGiá vốn\tTồn tối thiểu\tTồn\tNhà cung cấp\nKiểm thử Keo dán gạch\tbao\t95000\t10\t40\tBãi cát đá Tân Uyên\nKiểm thử Bột trét\tbao\t180000\t8\t5\t");
  ok("CSV/Excel paste imports items (new + opening stock)", imp.created === 2 && imp.stocked === 2, JSON.stringify(imp));
  const keo = await itemBySku(ws, "KIEM-THU-KEO-DAN-GACH");
  const st = await stockTake(ctxOf(ws), [{ itemId: keo.id as string, counted: 38 }]);
  ok("stock-take: a small difference (-2 bao) is adjusted", st.applied === 1 && (await totalOf(ws, keo.id as string)) === 38, JSON.stringify(st));
};

const tick = async (): Promise<void> => {
  const secret = process.env.ENGINE_SHARED_SECRET ?? "";
  const base = process.env.NIVO_BASE_URL || "https://nivo.vn";
  const ts = String(Date.now());
  const sig = createHmac("sha256", tickKey(secret)).update(ts).digest("hex");
  const res = await fetch(`${base}/api/automation/tick`, { method: "POST", headers: { "x-tick-timestamp": ts, "x-tick-signature": sig, "content-type": "application/json" }, body: "{}" });
  console.log(`INFO  signed tick → ${res.status} ${(await res.text()).slice(0, 120)}`);
};

if (which === "cafe" || which === "all") await cafe();
if (which === "building" || which === "all") await building();
if (which === "tick") await tick();
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
void defaultLocation;
