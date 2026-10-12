import "server-only";
import { logEvidence } from "./core";
import { admin, afterMovementsLater, deductForOrder, officeNote } from "./module-inventory-core";
import { formatQty } from "./module-inventory-shared";

/**
 * The inventory consumer of business events (called by emitEvent in src/lib/outbound-events.ts, never throws).
 *   order.confirmed  the confirmed order's goods leave stock: finished goods directly, a recipe's ingredients per product. Lines that match nothing are
 *                    reported in Office instead of guessed. Then the items that fell to their reorder point get a draft purchase order.
 * A workspace with no inventory items does nothing (the module is not in use).
 */
const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

export const onInventoryEvent = async (ws: string, event: string, data: Readonly<Record<string, unknown>>): Promise<void> => {
  if (event !== "order.confirmed") return;
  const db = admin();
  const { count } = await db.from("inventory_items").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("active", true);
  if (!count) return;
  const orderId = str(data.order_id);
  const orderNo = str(data.order_no) || orderId;
  const items = str(data.items);
  if (!orderId || !items.trim()) return;
  const r = await deductForOrder(db, ws, { orderId, orderNo, items });
  if (r.deducted.length) {
    const lines = r.deducted.map((d) => `${d.name} −${formatQty(d.qty)} ${d.unit} (còn ${formatQty(d.after)})`).join("; ");
    await logEvidence(db, ws, { kind: "inventory.order_deducted", actor: "Kho", summary: `Đơn ${orderNo} đã trừ kho: ${lines}`, evidence: items.slice(0, 300) });
  }
  if (r.unmatched.length) {
    await officeNote(db, ws, `Đơn ${orderNo} có ${r.unmatched.length} dòng chưa khớp hàng trong kho nên chưa trừ: ${r.unmatched.map((u) => `"${u}"`).join(", ")}. Bạn thêm tên gọi khác cho mặt hàng hoặc công thức rồi chỉnh tồn tay.`);
  }
  await afterMovementsLater(db, ws, r.deducted.map((d) => d.itemId));
};
