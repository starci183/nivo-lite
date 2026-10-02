"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Drawer, EmptyNotice, Input, SearchField, SegmentedControl, Select, SurfaceCard, Text } from "@starci/grammar/common";
import { formatMoney, formatQty, isSmallAdjustment, num, type StockStatus } from "@/lib/module-inventory-shared";
import type { InventoryWorkbench, ItemView } from "@/lib/module-inventory-queries";
import { adjustStockAction, draftLowStockAction, saveItem, setItemActive } from "./actions";
import {
  CHIPS_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, LIST_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, TOOLBAR_CLASS_NAME, TOOLBAR_FIELD_CLASS_NAME,
} from "./classNames";
import { Feedback, StockBadge, useRun } from "./parts";

type Filter = "all" | "low" | "out" | "over";
const FILTERS: ReadonlyArray<{ readonly id: Filter; readonly label: string }> = [
  { id: "all", label: "Tất cả" }, { id: "low", label: "Sắp hết" }, { id: "out", label: "Hết" }, { id: "over", label: "Dư" },
];
const matches = (f: Filter, s: StockStatus): boolean => f === "all" || (f === "low" ? s === "low" : f === "out" ? s === "out" : s === "over");

/** A step for the quick +/- buttons that suits the item: 1 for counted goods, bigger for grams and millilitres. */
const stepOf = (i: ItemView): number => {
  const basis = i.reorder_qty || i.reorder_point;
  if (basis <= 100) return 1;
  return 10 ** Math.floor(Math.log10(basis / 10));
};

const unitsText = (i: ItemView): string => i.units.map((u) => `${u.unit}=${u.factor}`).join(", ");

/* ------------------------------------------------------------------ the item form */

const ItemDrawer = ({ item, data, isOpen, onClose }: { readonly item: ItemView | null; readonly data: InventoryWorkbench; readonly isOpen: boolean; readonly onClose: () => void }) => {
  const run = useRun();
  const [f, setF] = useState(() => ({
    sku: item?.sku ?? "", name: item?.name ?? "", unit: item?.unit ?? "cái", units: item ? unitsText(item) : "", category: item?.category ?? "", cost: String(item?.cost_vnd ?? ""), sell: item?.sell_price_vnd === null || item?.sell_price_vnd === undefined ? "" : String(item.sell_price_vnd),
    reorderPoint: String(item?.reorder_point ?? ""), reorderQty: String(item?.reorder_qty ?? ""), supplierId: item?.supplier_id ?? "", aliases: item?.aliases.join(", ") ?? "", openingQty: "",
  }));
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = () => run.exec(() => saveItem({ id: item?.id, ...f }), () => { onClose(); });
  return (
    <Drawer isOpen={isOpen} onOpenChange={(o) => { if (!o) onClose(); }} title={item ? `Sửa ${item.name}` : "Thêm hàng"} description="Số lượng luôn tính theo đơn vị gốc; đơn vị khác (thùng, kg) quy đổi ra đơn vị gốc." closeLabel="Đóng" placement="right">
      <div className={FORM_CLASS_NAME}>
        <Input id="inv-name" name="name" label="Tên hàng" variant="secondary" isRequired value={f.name} onValueChange={set("name")} />
        <div className={FORM_GRID_CLASS_NAME}>
          <Input id="inv-sku" name="sku" label="Mã hàng" hint="Để trống, NIVO tự đặt." variant="secondary" value={f.sku} onValueChange={set("sku")} />
          <Input id="inv-unit" name="unit" label="Đơn vị gốc" hint="Ví dụ: chai, g, bao" variant="secondary" value={f.unit} onValueChange={set("unit")} />
        </div>
        <Input id="inv-units" name="units" label="Đơn vị khác" hint="Ví dụ: thùng=24, kg=1000 (1 thùng bằng 24 đơn vị gốc)" variant="secondary" value={f.units} onValueChange={set("units")} />
        <div className={FORM_GRID_CLASS_NAME}>
          <Input id="inv-cat" name="category" label="Nhóm hàng" variant="secondary" value={f.category} onValueChange={set("category")} />
          <Select label="Nhà cung cấp quen" placeholder="Chưa chọn" value={f.supplierId || null} options={data.suppliers.map((s) => ({ id: s.id, label: s.name }))} onValueChange={(v) => set("supplierId")(v ?? "")} />
        </div>
        <div className={FORM_GRID_CLASS_NAME}>
          <Input id="inv-cost" name="cost" label="Giá vốn / đơn vị gốc (₫)" variant="secondary" value={f.cost} onValueChange={set("cost")} />
          <Input id="inv-sell" name="sell" label="Giá bán (không bắt buộc)" variant="secondary" value={f.sell} onValueChange={set("sell")} />
          <Input id="inv-rp" name="reorderPoint" label="Tồn tối thiểu" hint="Xuống mức này thì NIVO soạn đơn nhập." variant="secondary" value={f.reorderPoint} onValueChange={set("reorderPoint")} />
          <Input id="inv-rq" name="reorderQty" label="Nhập mỗi lần" variant="secondary" value={f.reorderQty} onValueChange={set("reorderQty")} />
        </div>
        <Input id="inv-alias" name="aliases" label="Tên gọi khác trên đơn hàng" hint="Cách nhau bằng dấu phẩy. Giúp NIVO trừ kho đúng khi đơn ghi tên khác." variant="secondary" value={f.aliases} onValueChange={set("aliases")} />
        {item ? null : <Input id="inv-open" name="openingQty" label="Số lượng đang có" variant="secondary" value={f.openingQty} onValueChange={set("openingQty")} />}
        <Feedback error={run.error} notice={run.notice} />
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="primary" isPending={run.isPending} onPress={save}>Lưu</Button>
          {item ? <Button variant="outline" isDisabled={run.isPending} onPress={() => run.exec(() => setItemActive(item.id, !item.active), () => { onClose(); })}>{item.active ? "Ngừng theo dõi" : "Theo dõi lại"}</Button> : null}
        </div>
      </div>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ the adjustment form */

const AdjustDrawer = ({ item, onClose }: { readonly item: ItemView | null; readonly onClose: () => void }) => {
  const run = useRun();
  const [mode, setMode] = useState<"set" | "delta">("set");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const target = item ? (mode === "set" ? num(value, item.total) : item.total + num(value)) : 0;
  const delta = item ? target - item.total : 0;
  const small = item ? isSmallAdjustment(delta, item.cost_vnd) : true;
  const submit = () => item && run.exec(
    () => adjustStockAction(mode === "set" ? { itemId: item.id, counted: num(value), reason } : { itemId: item.id, delta: num(value), reason }),
    (r) => { if (r.state === "applied") { onClose(); return undefined; } return "Thay đổi lớn nên đã gửi cho bạn duyệt (xem mục Chờ duyệt phía trên)."; },
  );
  return (
    <Drawer isOpen={item !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={item ? `Chỉnh tồn ${item.name}` : "Chỉnh tồn"} description={item ? `Đang có ${formatQty(item.total)} ${item.unit}` : undefined} closeLabel="Đóng" placement="right">
      {item ? (
        <div className={FORM_CLASS_NAME}>
          <SegmentedControl label="Cách chỉnh" options={[{ value: "set", label: "Đặt số mới" }, { value: "delta", label: "Cộng / trừ" }]} value={mode} onValueChange={(v) => setMode(v === "delta" ? "delta" : "set")} />
          <Input id="adj-value" name="value" label={mode === "set" ? `Số đếm được (${item.unit})` : `Thay đổi (${item.unit}, số âm để trừ)`} variant="secondary" value={value} onValueChange={setValue} />
          <Input id="adj-reason" name="reason" label="Lý do" hint="Ví dụ: hao hụt, vỡ, đếm lại kho" variant="secondary" value={reason} onValueChange={setReason} />
          {value.trim() ? (
            <Text size="sm" tone="muted">
              {formatQty(item.total)} → {formatQty(target)} {item.unit}. {small ? "Thay đổi nhỏ, áp dụng ngay." : `Thay đổi lớn (khoảng ${formatMoney(Math.abs(delta) * item.cost_vnd)}), cần bạn duyệt.`}
            </Text>
          ) : null}
          <Feedback error={run.error} notice={run.notice} />
          <div><Button variant="primary" isPending={run.isPending} isDisabled={!value.trim()} onPress={submit}>{small ? "Ghi chỉnh tồn" : "Gửi duyệt chỉnh tồn"}</Button></div>
        </div>
      ) : null}
    </Drawer>
  );
};

/* ------------------------------------------------------------------ the panel */

export const StockPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const run = useRun();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<ItemView | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<ItemView | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.items.filter((i) => (showInactive ? !i.active : i.active) && matches(filter, i.status) && (!needle || `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(needle)));
  }, [data.items, q, filter, showInactive]);
  const supplierOf = (id: string | null) => data.suppliers.find((s) => s.id === id)?.name ?? null;
  const quick = (i: ItemView, sign: 1 | -1) => run.exec(() => adjustStockAction({ itemId: i.id, delta: sign * stepOf(i), reason: sign > 0 ? "Cộng nhanh" : "Trừ nhanh" }), (r) => (r.state === "waiting" ? "Đã gửi bạn duyệt thay đổi này." : undefined));
  const lowCount = data.metrics.lowCount + data.metrics.outCount;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={TOOLBAR_CLASS_NAME}>
        <div className={TOOLBAR_FIELD_CLASS_NAME}>
          <SearchField label="Tìm hàng" isLabelHidden placeholder="Tìm theo tên, mã, nhóm" clearLabel="Xoá tìm kiếm" value={q} onValueChange={setQ} onClear={() => setQ("")} />
        </div>
        <div className={ROW_ACTIONS_CLASS_NAME}>
          {data.canManage ? <Button variant="primary" size="sm" onPress={() => setEditing("new")}>Thêm hàng</Button> : null}
          {data.canManage && lowCount > 0 ? <Button variant="secondary" size="sm" isPending={run.isPending} onPress={() => run.exec(() => draftLowStockAction(), (r) => (r.drafted ? `Đã soạn ${r.drafted} đơn nhập, xem tab Đơn nhập.` : "Các món sắp hết đã có đơn nhập đang chờ giao."))}>Soạn đơn cho hàng sắp hết</Button> : null}
        </div>
      </div>
      <SegmentedControl label="Lọc theo tình trạng" isLabelHidden options={FILTERS.map((f) => ({ value: f.id, label: f.label }))} value={filter} onValueChange={(v) => setFilter(FILTERS.find((f) => f.id === v)?.id ?? "all")} />
      <Feedback error={run.error} notice={run.notice} />
      <SurfaceCard ariaLabel="Danh sách hàng">
        {rows.length === 0 ? (
          <EmptyNotice message={data.items.length === 0 ? "Chưa có mặt hàng nào" : "Không có mặt hàng phù hợp"} description={data.items.length === 0 ? "Thêm hàng, dán bảng từ Excel hoặc nạp mẫu theo ngành ở tab Nhập dữ liệu." : "Thử đổi bộ lọc hoặc từ khoá."} />
        ) : (
          <ul className={LIST_CLASS_NAME} aria-label="Hàng trong kho">
            {rows.map((i) => (
              <li key={i.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}>
                    <Text weight="semibold">{i.name}</Text>
                    <StockBadge status={i.status} />
                    {i.onOrder > 0 ? <Badge tone="accent">Đang đặt {formatQty(i.onOrder)} {i.unit}</Badge> : null}
                  </div>
                  <Text size="sm" tone="muted">
                    {i.sku}{i.category ? ` · ${i.category}` : ""}{supplierOf(i.supplier_id) ? ` · ${supplierOf(i.supplier_id)}` : ""}
                    {i.reorder_point > 0 ? ` · tối thiểu ${formatQty(i.reorder_point)}` : ""}{i.cost_vnd > 0 ? ` · vốn ${formatMoney(i.cost_vnd)}/${i.unit}` : ""}
                  </Text>
                </div>
                <div className={ROW_ACTIONS_CLASS_NAME}>
                  <Text size="md" weight="semibold">{formatQty(i.total)} {i.unit}</Text>
                  <Button variant="outline" size="sm" aria-label={`Giảm ${formatQty(stepOf(i))} ${i.unit} ${i.name}`} isDisabled={run.isPending} onPress={() => quick(i, -1)}>−{formatQty(stepOf(i))}</Button>
                  <Button variant="outline" size="sm" aria-label={`Tăng ${formatQty(stepOf(i))} ${i.unit} ${i.name}`} isDisabled={run.isPending} onPress={() => quick(i, 1)}>+{formatQty(stepOf(i))}</Button>
                  <Button variant="ghost" size="sm" onPress={() => setAdjusting(i)}>Chỉnh tồn</Button>
                  {data.canManage ? <Button variant="ghost" size="sm" onPress={() => setEditing(i)}>Sửa</Button> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      {data.canManage && data.items.some((i) => !i.active) ? <div><Button variant="ghost" size="sm" onPress={() => setShowInactive((v) => !v)}>{showInactive ? "Xem hàng đang theo dõi" : "Xem hàng đã ngừng theo dõi"}</Button></div> : null}
      {editing !== null ? <ItemDrawer key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} data={data} isOpen onClose={() => setEditing(null)} /> : null}
      <AdjustDrawer key={adjusting?.id ?? "none"} item={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
};

