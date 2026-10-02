"use client";

import { useState } from "react";
import { Badge, Button, Drawer, EmptyNotice, Input, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { decideWorkItem } from "@/lib/flow-actions";
import { formatMoney, formatQty, isOpenPo, num, type PoStatus } from "@/lib/module-inventory-shared";
import type { InventoryWorkbench, PoView } from "@/lib/module-inventory-queries";
import { cancelPoAction, createPoAction, receivePoAction, remindSupplierAction, requestSendAction, updatePoDraft } from "./actions";
import {
  BOARD_CLASS_NAME, CARD_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, LANE_BODY_CLASS_NAME, LANE_CLASS_NAME, LANE_HEAD_CLASS_NAME, LINE_ROW_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME,
} from "./classNames";
import { Feedback, PO_LABEL, PoBadge, formatDate, useRun } from "./parts";

const LANES: ReadonlyArray<PoStatus> = ["draft", "waiting_approval", "sent", "partially_received", "received", "cancelled"];

const channelWord = (c: PoView["channel"]): string => (c === "zalo" ? "Zalo" : c === "phone" ? "điện thoại" : "email");

const copyText = async (t: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ one order, in a drawer */

const PoDrawer = ({ po, data, onClose }: { readonly po: PoView; readonly data: InventoryWorkbench; readonly onClose: () => void }) => {
  const run = useRun();
  const [supplierId, setSupplierId] = useState(po.supplierId ?? "");
  const [expected, setExpected] = useState(po.expected_at ?? "");
  const [lines, setLines] = useState(() => po.lines.map((l) => ({ lineId: l.id, qty: String(l.qtyOrdered), unitCost: String(l.unitCost) })));
  const [message, setMessage] = useState(po.message);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [recv, setRecv] = useState(() => po.lines.map((l) => ({ lineId: l.id, qty: String(Math.max(0, l.qtyOrdered - l.qtyReceived)), unitCost: String(l.unitCost) })));
  const setLine = (i: number, k: "qty" | "unitCost", v: string) => setLines((p) => p.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  const setRecvLine = (i: number, k: "qty" | "unitCost", v: string) => setRecv((p) => p.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + num(l.qty) * num(l.unitCost), 0);
  const [copied, setCopied] = useState(false);

  const saveDraft = () => run.exec(() => updatePoDraft({ poId: po.id, supplierId, expectedAt: expected, lines }), () => "Đã lưu đơn nháp.");
  const sendForApproval = () => run.exec(async () => {
    const saved = await updatePoDraft({ poId: po.id, supplierId, expectedAt: expected, lines });
    return saved.ok ? requestSendAction(po.id) : saved;
  }, (r) => (r && "status" in r && r.status === "done" ? "Đơn đã được gửi." : "Đã soạn tin nhắn và chuyển cho bạn duyệt."));
  const approve = () => po.work_item_id && run.exec(() => decideWorkItem(po.work_item_id as string, "approved", message.trim() === po.message.trim() ? undefined : { draft: message }), () => { onClose(); });
  const reject = () => po.work_item_id && run.exec(() => decideWorkItem(po.work_item_id as string, "rejected", undefined, "Từ chối trong màn Kho"), () => { onClose(); });
  const receive = () => run.exec(() => receivePoAction({ poId: po.id, invoiceNo, note: "", lines: recv }), (r) => `Đã nhận hàng (${r.status === "received" ? "đủ" : "một phần"})${r.priceChanges.length ? `, giá đổi: ${r.priceChanges.join("; ")}` : ""}${r.handedToAccounting ? ". Đã chuyển khoản phải trả cho Kế toán." : "."}`);

  const editable = po.status === "draft";
  const receiving = po.status === "sent" || po.status === "partially_received";
  return (
    <Drawer isOpen onOpenChange={(o) => { if (!o) onClose(); }} title={`Đơn nhập ${po.po_no}`} description={`${po.supplierName} · ${PO_LABEL[po.status]}${po.source === "auto" ? " · NIVO soạn" : ""}`} closeLabel="Đóng" placement="right">
      <div className={FORM_CLASS_NAME}>
        {editable ? (
          <div className={FORM_GRID_CLASS_NAME}>
            <Select label="Nhà cung cấp" placeholder="Chọn nhà cung cấp" value={supplierId || null} options={data.suppliers.map((s) => ({ id: s.id, label: s.name }))} onValueChange={(v) => setSupplierId(v ?? "")} />
            <Input id="po-expected" name="expected" label="Cần hàng trước (năm-tháng-ngày)" hint="Ví dụ 2026-10-15" variant="secondary" value={expected} onValueChange={setExpected} />
          </div>
        ) : (
          <Text size="sm" tone="muted">Cần hàng trước: {formatDate(po.expected_at)} · Tổng {formatMoney(po.total_vnd)}{po.reminders ? ` · đã nhắc ${po.reminders} lần` : ""}</Text>
        )}

        <Text weight="semibold">Mặt hàng</Text>
        {editable ? (
          <>
            {po.lines.map((l, i) => (
              <div key={l.id} className={LINE_ROW_CLASS_NAME}>
                <Text size="sm" weight="medium">{l.name} <Text as="span" size="xs" tone="muted">({l.unit})</Text></Text>
                <Input id={`po-q-${l.id}`} name={`q-${l.id}`} label="Số lượng" variant="secondary" value={lines[i]?.qty ?? ""} onValueChange={(v) => setLine(i, "qty", v)} />
                <Input id={`po-c-${l.id}`} name={`c-${l.id}`} label="Đơn giá" variant="secondary" value={lines[i]?.unitCost ?? ""} onValueChange={(v) => setLine(i, "unitCost", v)} />
              </div>
            ))}
            <Text size="sm" tone="muted">Đặt số lượng 0 để bỏ một dòng. Tạm tính {formatMoney(total)}.</Text>
          </>
        ) : receiving ? (
          <>
            <Text size="sm" tone="muted">Nhập số thực nhận (nhận một phần cũng được) và giá thực tế; giá vốn sẽ tính lại theo bình quân.</Text>
            {po.lines.map((l, i) => (
              <div key={l.id} className={LINE_ROW_CLASS_NAME}>
                <Text size="sm" weight="medium">{l.name} <Text as="span" size="xs" tone="muted">đặt {formatQty(l.qtyOrdered)}, đã nhận {formatQty(l.qtyReceived)} {l.unit}</Text></Text>
                <Input id={`rc-q-${l.id}`} name={`rq-${l.id}`} label="Nhận lần này" variant="secondary" value={recv[i]?.qty ?? ""} onValueChange={(v) => setRecvLine(i, "qty", v)} />
                <Input id={`rc-c-${l.id}`} name={`rc-${l.id}`} label="Đơn giá thực" variant="secondary" value={recv[i]?.unitCost ?? ""} onValueChange={(v) => setRecvLine(i, "unitCost", v)} />
              </div>
            ))}
            <Input id="rc-invoice" name="invoice" label="Số hoá đơn của nhà cung cấp (không bắt buộc)" hint="Có hoá đơn thì NIVO chuyển khoản phải trả cho Kế toán nếu bạn dùng module Kế toán." variant="secondary" value={invoiceNo} onValueChange={setInvoiceNo} />
          </>
        ) : (
          po.lines.map((l) => <Text key={l.id} size="sm">{l.name}: đặt {formatQty(l.qtyOrdered)}, nhận {formatQty(l.qtyReceived)} {l.unit} · {formatMoney(l.unitCost)}</Text>)
        )}

        {po.status === "waiting_approval" ? (
          <>
            <Textarea label={`Tin nhắn gửi ${po.supplierName} (${channelWord(po.channel)})`} description="NIVO soạn sẵn; bạn sửa được trước khi duyệt." rows={9} value={message} onValueChange={setMessage} />
          </>
        ) : po.message ? (
          <div className={QUOTE_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="medium">Tin nhắn đã soạn</Text>
            <Text size="sm">{po.message}</Text>
          </div>
        ) : null}
        {po.send_note ? <Text size="sm" tone="muted">{po.send_note}</Text> : null}
        {po.sent_via === "email" ? <Badge tone="success">Đã gửi email cho nhà cung cấp</Badge> : null}

        <Feedback error={run.error} notice={run.notice} />
        <div className={ROW_ACTIONS_CLASS_NAME}>
          {editable && data.canManage ? (
            <>
              <Button variant="primary" isPending={run.isPending} isDisabled={!supplierId} onPress={sendForApproval}>Soạn tin và gửi duyệt</Button>
              <Button variant="secondary" isDisabled={run.isPending} onPress={saveDraft}>Lưu nháp</Button>
            </>
          ) : null}
          {po.status === "waiting_approval" && po.work_item_id ? (
            <>
              <Button variant="primary" isPending={run.isPending} onPress={approve}>Duyệt và gửi</Button>
              <Button variant="outline" isDisabled={run.isPending} onPress={reject}>Từ chối</Button>
            </>
          ) : null}
          {receiving && data.canManage ? (
            <>
              <Button variant="primary" isPending={run.isPending} onPress={receive}>Ghi nhận nhận hàng</Button>
              <Button variant="secondary" isDisabled={run.isPending} onPress={() => run.exec(() => remindSupplierAction(po.id), () => "Đã soạn tin nhắc, chờ bạn duyệt trong mục Chờ duyệt.")}>Nhắc nhà cung cấp</Button>
            </>
          ) : null}
          {po.message && (po.status === "sent" || po.status === "partially_received" || po.status === "waiting_approval") ? (
            <Button variant="ghost" onPress={async () => setCopied(await copyText(po.message))}>{copied ? "Đã chép tin nhắn" : "Chép tin nhắn"}</Button>
          ) : null}
          {data.canManage && (po.status === "draft" || po.status === "waiting_approval" || po.status === "sent") ? (
            <Button variant="danger-soft" isDisabled={run.isPending} onPress={() => run.exec(() => cancelPoAction(po.id), () => { onClose(); })}>Huỷ đơn</Button>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ a new order by hand */

const CreateDrawer = ({ data, onClose }: { readonly data: InventoryWorkbench; readonly onClose: () => void }) => {
  const run = useRun();
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Array<{ itemId: string; qty: string; unitCost: string }>>([{ itemId: "", qty: "", unitCost: "" }]);
  const setLine = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((p) => p.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: string) => {
    const item = data.items.find((x) => x.id === id);
    setLine(i, { itemId: id, qty: lines[i]?.qty || (item?.reorder_qty ? String(item.reorder_qty) : ""), unitCost: item ? String(item.cost_vnd) : "" });
  };
  const options = data.items.filter((i) => i.active && (!supplierId || !i.supplier_id || i.supplier_id === supplierId)).map((i) => ({ id: i.id, label: `${i.name} (${i.unit})` }));
  return (
    <Drawer isOpen onOpenChange={(o) => { if (!o) onClose(); }} title="Tạo đơn nhập" description="Chọn nhà cung cấp và mặt hàng. Đơn tạo ra ở dạng nháp, bạn gửi duyệt sau." closeLabel="Đóng" placement="right">
      <div className={FORM_CLASS_NAME}>
        <Select label="Nhà cung cấp" placeholder="Chọn nhà cung cấp" value={supplierId || null} options={data.suppliers.map((s) => ({ id: s.id, label: s.name }))} onValueChange={(v) => setSupplierId(v ?? "")} />
        {lines.map((l, i) => (
          <div key={i} className={LINE_ROW_CLASS_NAME}>
            <Select label={`Mặt hàng ${i + 1}`} placeholder="Chọn hàng" value={l.itemId || null} options={options} onValueChange={(v) => pickItem(i, v ?? "")} />
            <Input id={`new-q-${i}`} name={`nq-${i}`} label="Số lượng" variant="secondary" value={l.qty} onValueChange={(v) => setLine(i, { qty: v })} />
            <Input id={`new-c-${i}`} name={`nc-${i}`} label="Đơn giá" variant="secondary" value={l.unitCost} onValueChange={(v) => setLine(i, { unitCost: v })} />
          </div>
        ))}
        <div><Button variant="ghost" size="sm" onPress={() => setLines((p) => [...p, { itemId: "", qty: "", unitCost: "" }])}>Thêm dòng</Button></div>
        <Feedback error={run.error} notice={run.notice} />
        <div><Button variant="primary" isPending={run.isPending} onPress={() => run.exec(() => createPoAction({ supplierId, expectedAt: "", lines }), () => { onClose(); })}>Tạo đơn nháp</Button></div>
      </div>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ the board */

export const OrdersPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const open = data.pos.find((p) => p.id === openId) ?? null;
  const lanes = LANES.map((status) => ({ status, rows: data.pos.filter((p) => p.status === status) }));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={ROW_ACTIONS_CLASS_NAME}>
        {data.canManage ? <Button variant="primary" size="sm" onPress={() => setCreating(true)}>Tạo đơn nhập</Button> : null}
        <Text size="sm" tone="muted">{data.metrics.openPos} đơn đang mở</Text>
      </div>
      {data.pos.length === 0 ? (
        <SurfaceCard ariaLabel="Đơn nhập"><EmptyNotice message="Chưa có đơn nhập nào" description="Khi hàng xuống mức tối thiểu, NIVO tự soạn đơn nháp theo nhà cung cấp. Bạn cũng tự tạo đơn được." /></SurfaceCard>
      ) : (
        <div className={BOARD_CLASS_NAME} role="group" aria-label="Đơn nhập theo trạng thái">
          {lanes.map((lane) => (
            <section key={lane.status} className={LANE_CLASS_NAME} aria-label={PO_LABEL[lane.status]}>
              <div className={LANE_HEAD_CLASS_NAME}>
                <Text weight="semibold" size="sm">{PO_LABEL[lane.status]}</Text>
                <Badge tone="neutral">{lane.rows.length}</Badge>
              </div>
              <ul className={LANE_BODY_CLASS_NAME}>
                {lane.rows.map((p) => (
                  <li key={p.id} className={CARD_CLASS_NAME}>
                    <div className={CHIPS_CLASS_NAME}>
                      <Text weight="semibold" size="sm">{p.po_no}</Text>
                      <PoBadge status={p.status} />
                    </div>
                    <Text size="sm">{p.supplierName}</Text>
                    <Text size="xs" tone="muted">{p.lines.length} mặt hàng · {formatMoney(p.total_vnd)}{p.expected_at && isOpenPo(p.status) ? ` · hẹn ${formatDate(p.expected_at)}` : ""}</Text>
                    {p.status === "sent" && p.sent_via === "copy" ? <Text size="xs" tone="muted">Đã duyệt, chép tin gửi qua {channelWord(p.channel)}</Text> : null}
                    <div><Button variant="outline" size="sm" onPress={() => setOpenId(p.id)}>Mở</Button></div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {open ? <PoDrawer key={open.id + open.status} po={open} data={data} onClose={() => setOpenId(null)} /> : null}
      {creating ? <CreateDrawer data={data} onClose={() => setCreating(false)} /> : null}
    </div>
  );
};
