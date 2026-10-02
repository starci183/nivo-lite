import "server-only";
import type { Performed, Performer } from "./engine";
import { renderEmail } from "./email/layout";
import { sendWorkspaceEmail } from "./email/send";
import { logEvidence } from "./core";
import { admin, afterMovementsLater, applyMovement, loadPo, shopName, supplierEmail } from "./module-inventory-core";
import { formatQty } from "./module-inventory-shared";

/**
 * Performers of the inventory actions: what happens once the gate lets an action through (by the owner's rule, or after the owner approved it).
 *   send_purchase_order  the order (or a reminder) goes to the supplier: by email through the workspace SMTP (gate-approved work item id as proof),
 *                        or, for a Zalo / phone supplier or an email that could not go out, the message is kept copy-ready on the order (sent_via "copy").
 *   adjust_stock         the approved quantity change is applied as a movement.
 * draft_purchase_order needs no performer: a draft is internal and created by module-inventory-core (it records its own decision).
 */
const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const now = () => new Date().toISOString();

export const sendPurchaseOrder: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p): Promise<Performed> => {
    const db = admin();
    const po = await loadPo(db, c.ws, str(p.fields.po_id));
    if (!po) throw new Error("Không tìm thấy đơn nhập.");
    const reminder = str(p.fields.kind) === "reminder";
    if (!reminder && po.status !== "waiting_approval" && po.status !== "draft") {
      return { summary: `Đơn ${po.po_no} đã ở trạng thái "${po.status}", không gửi lại.`, evidence: "pending" };
    }
    const text = (p.draft ?? po.message).trim();
    if (!text) throw new Error("Đơn này chưa có nội dung tin nhắn.");
    const supplier = po.supplier;
    let via: "email" | "copy" = "copy";
    let note: string | null = null;
    const to = supplierEmail(supplier);
    if (to) {
      const shop = await shopName(db, c.ws);
      const subject = reminder ? `${shop}: nhắc đơn nhập ${po.po_no}` : `${shop}: đơn nhập hàng ${po.po_no}`;
      const mail = renderEmail({ shopName: shop, title: subject, body: text });
      const r = await sendWorkspaceEmail({
        workspaceId: c.ws, to, subject, html: mail.html, text: mail.text, purpose: reminder ? "inventory_po_reminder" : "inventory_po", refs: { po_id: po.id, po_no: po.po_no },
        audience: "customer", workItemId: item.id,
      });
      if (r.status === "sent") via = "email";
      else note = r.error ?? "Email chưa gửi được.";
    } else if (supplier?.channel === "email") {
      note = "Nhà cung cấp chưa có email hợp lệ.";
    }
    const who = supplier?.name ?? "nhà cung cấp";
    const channelWord = supplier?.channel === "zalo" ? "Zalo" : supplier?.channel === "phone" ? "điện thoại" : "email";
    if (reminder) {
      await db.from("inventory_purchase_orders").update({ reminders: po.reminders + 1, message: po.message, send_note: via === "copy" ? note ?? `Chép tin nhắc để gửi qua ${channelWord}` : null, updated_at: now() }).eq("id", po.id);
    } else {
      await db.from("inventory_purchase_orders").update({
        status: "sent", sent_at: now(), sent_via: via, message: text, work_item_id: item.id, updated_at: now(),
        send_note: via === "copy" ? (note ?? `Đã duyệt. Chép tin nhắn và gửi qua ${channelWord} cho ${who}.`) : null,
      }).eq("id", po.id);
    }
    await logEvidence(db, c.ws, {
      work_item_id: item.id, kind: reminder ? "inventory.po_reminder" : "inventory.po_sent", actor: c.actor,
      summary: via === "email" ? `${reminder ? "Đã nhắc" : "Đã gửi đơn"} ${po.po_no} cho ${who} qua email` : `Đã duyệt ${reminder ? "tin nhắc" : "đơn"} ${po.po_no} cho ${who}: tin nhắn sẵn để gửi qua ${channelWord}`,
      evidence: note,
    });
    const summary = via === "email"
      ? `${reminder ? "Đã nhắc" : "Đã gửi đơn"} ${po.po_no} cho ${who} qua email`
      : `Đã duyệt ${reminder ? "tin nhắc" : "đơn"} ${po.po_no}. Tin nhắn sẵn trong Kho để bạn chép gửi ${who} qua ${channelWord}${note ? ` (${note})` : ""}`;
    return { summary, evidence: via === "email" ? "captured" : "pending", href: "/m/inventory/workbench?tab=orders", detail: text };
  },
  onReject: async (c, item, p) => {
    if (str(p.fields.kind) === "reminder") return;
    // The owner said no: the order goes back to a draft they can edit or cancel.
    await admin().from("inventory_purchase_orders").update({ status: "draft", work_item_id: null, send_note: "Bạn đã từ chối gửi đơn này.", updated_at: now() }).eq("workspace_id", c.ws).eq("id", str(p.fields.po_id)).eq("status", "waiting_approval");
  },
};

export const adjustStockPerformer: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by): Promise<Performed> => {
    const db = admin();
    const itemId = str(p.fields.item_id);
    const delta = Number(p.fields.delta) || 0;
    const row = ((await db.from("inventory_items").select("name, unit").eq("workspace_id", c.ws).eq("id", itemId).maybeSingle()).data ?? null) as { name: string; unit: string } | null;
    if (!row) throw new Error("Không tìm thấy mặt hàng.");
    const reason = str(p.fields.reason) || "Chỉnh số tồn";
    const r = await applyMovement(db, c.ws, {
      itemId, locationId: str(p.fields.location_id) || undefined, kind: "adjust", delta, reason, refType: str(p.fields.ref_type) === "count" ? "count" : "manual", by: by.name,
      evidence: str(p.fields.evidence) || null, dedupe: `adjust:${item.id}`,
    });
    await afterMovementsLater(db, c.ws, [itemId]);
    return {
      summary: `Đã chỉnh tồn ${row.name}: ${formatQty(r.before)} → ${formatQty(r.after)} ${row.unit} (${reason})`, evidence: "captured", href: "/m/inventory/workbench?tab=history",
    };
  },
};
