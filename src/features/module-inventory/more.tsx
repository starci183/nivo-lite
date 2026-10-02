"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Drawer, EmptyNotice, Input, SearchField, SegmentedControl, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { formatQty, num } from "@/lib/module-inventory-shared";
import type { InventoryWorkbench, RecipeView, SupplierView } from "@/lib/module-inventory-queries";
import { deleteRecipe, importPasteAction, loadTemplateAction, saveRecipe, saveSupplier, stockTakeAction } from "./actions";
import {
  CHIPS_CLASS_NAME, COUNT_FIELD_CLASS_NAME, COUNT_ROW_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, LINE_ROW_CLASS_NAME, LIST_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME,
  TOOLBAR_CLASS_NAME, TOOLBAR_FIELD_CLASS_NAME,
} from "./classNames";
import { Feedback, MOVE_LABEL, MOVE_TONE, formatStamp, useRun } from "./parts";

const CHANNELS = [{ id: "email", label: "Email" }, { id: "zalo", label: "Zalo" }, { id: "phone", label: "Điện thoại" }] as const;
const channelLabel = (c: string): string => CHANNELS.find((x) => x.id === c)?.label ?? c;

/* ------------------------------------------------------------------ suppliers */

const SupplierDrawer = ({ supplier, onClose }: { readonly supplier: SupplierView | null; readonly onClose: () => void }) => {
  const run = useRun();
  const [f, setF] = useState({
    name: supplier?.name ?? "", contactName: supplier?.contact_name ?? "", email: supplier?.email ?? "", phone: supplier?.phone ?? "", zalo: supplier?.zalo ?? "",
    channel: supplier?.channel ?? "email", leadTime: String(supplier?.lead_time_days ?? 2), terms: supplier?.payment_terms ?? "", note: supplier?.note ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Drawer isOpen onOpenChange={(o) => { if (!o) onClose(); }} title={supplier ? `Sửa ${supplier.name}` : "Thêm nhà cung cấp"} description="Kênh gửi quyết định cách đơn nhập đến tay họ: email gửi thẳng, Zalo và điện thoại thì NIVO soạn sẵn tin để bạn chép." closeLabel="Đóng" placement="right">
      <div className={FORM_CLASS_NAME}>
        <Input id="sup-name" name="name" label="Tên nhà cung cấp" variant="secondary" isRequired value={f.name} onValueChange={set("name")} />
        <Input id="sup-contact" name="contact" label="Người liên hệ" variant="secondary" value={f.contactName} onValueChange={set("contactName")} />
        <SegmentedControl label="Gửi đơn qua" options={CHANNELS.map((c) => ({ value: c.id, label: c.label }))} value={f.channel} onValueChange={(v) => set("channel")(v)} />
        <div className={FORM_GRID_CLASS_NAME}>
          <Input id="sup-email" name="email" kind="email" label="Email" variant="secondary" value={f.email} onValueChange={set("email")} />
          <Input id="sup-phone" name="phone" label="Điện thoại" variant="secondary" value={f.phone} onValueChange={set("phone")} />
          <Input id="sup-zalo" name="zalo" label="Zalo" variant="secondary" value={f.zalo} onValueChange={set("zalo")} />
          <Input id="sup-lead" name="lead" label="Giao trong (ngày)" variant="secondary" value={f.leadTime} onValueChange={set("leadTime")} />
        </div>
        <Input id="sup-terms" name="terms" label="Điều kiện thanh toán" variant="secondary" value={f.terms} onValueChange={set("terms")} />
        <Textarea label="Ghi chú" rows={2} value={f.note} onValueChange={set("note")} />
        <Feedback error={run.error} notice={run.notice} />
        <div><Button variant="primary" isPending={run.isPending} onPress={() => run.exec(() => saveSupplier({ id: supplier?.id, ...f }), () => { onClose(); })}>Lưu</Button></div>
      </div>
    </Drawer>
  );
};

export const SuppliersPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const [editing, setEditing] = useState<SupplierView | "new" | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {data.canManage ? <div><Button variant="primary" size="sm" onPress={() => setEditing("new")}>Thêm nhà cung cấp</Button></div> : null}
      <SurfaceCard ariaLabel="Nhà cung cấp">
        {data.suppliers.length === 0 ? <EmptyNotice message="Chưa có nhà cung cấp" description="Thêm người bạn hay mua hàng để NIVO gom đơn nhập đúng nơi." /> : (
          <ul className={LIST_CLASS_NAME}>
            {data.suppliers.map((s) => (
              <li key={s.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}><Text weight="semibold">{s.name}</Text><Badge tone="neutral">{channelLabel(s.channel)}</Badge></div>
                  <Text size="sm" tone="muted">{[s.contact_name, s.email, s.phone, s.zalo ? `Zalo ${s.zalo}` : "", `giao trong ${s.lead_time_days} ngày`, s.payment_terms].filter(Boolean).join(" · ")}</Text>
                  <Text size="xs" tone="muted">{data.items.filter((i) => i.supplier_id === s.id && i.active).length} mặt hàng quen mua</Text>
                </div>
                {data.canManage ? <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="outline" size="sm" onPress={() => setEditing(s)}>Sửa</Button></div> : null}
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      {editing !== null ? <SupplierDrawer key={editing === "new" ? "new" : editing.id} supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ movement history */

export const HistoryPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.movements.filter((m) => (kind === "all" || m.kind === kind) && (!needle || `${m.itemName} ${m.reason} ${m.ref_label ?? ""}`.toLowerCase().includes(needle)));
  }, [data.movements, q, kind]);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={TOOLBAR_CLASS_NAME}>
        <div className={TOOLBAR_FIELD_CLASS_NAME}><SearchField label="Tìm trong lịch sử" isLabelHidden placeholder="Tên hàng, lý do, mã đơn" clearLabel="Xoá tìm kiếm" value={q} onValueChange={setQ} onClear={() => setQ("")} /></div>
        <SegmentedControl label="Loại" isLabelHidden options={[{ value: "all", label: "Tất cả" }, { value: "in", label: "Nhập" }, { value: "out", label: "Xuất" }, { value: "adjust", label: "Chỉnh" }]} value={kind} onValueChange={setKind} />
      </div>
      <SurfaceCard ariaLabel="Lịch sử xuất nhập">
        {rows.length === 0 ? <EmptyNotice message="Chưa có biến động nào" description="Mỗi lần nhập, bán, chỉnh hoặc kiểm kê đều được ghi lại ở đây, kèm lý do và người làm." /> : (
          <ul className={LIST_CLASS_NAME} aria-label="Biến động kho">
            {rows.map((m) => (
              <li key={m.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}>
                    <Badge tone={MOVE_TONE[m.kind] ?? "neutral"}>{MOVE_LABEL[m.kind] ?? m.kind}</Badge>
                    <Text weight="semibold">{m.itemName}</Text>
                    <Text weight="semibold">{m.qty > 0 ? "+" : ""}{formatQty(m.qty)} {m.unit}</Text>
                  </div>
                  <Text size="sm" tone="muted">{m.reason}{m.ref_label ? ` · ${m.ref_label}` : ""} · còn {formatQty(m.qty_after)} · {m.by_name}</Text>
                  {m.evidence ? <Text size="xs" tone="muted" overflow="clamp-2">{m.evidence}</Text> : null}
                </div>
                <Text size="xs" tone="muted">{formatStamp(m.created_at)}</Text>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
};

/* ------------------------------------------------------------------ recipes */

const RecipeDrawer = ({ recipe, data, onClose }: { readonly recipe: RecipeView | null; readonly data: InventoryWorkbench; readonly onClose: () => void }) => {
  const run = useRun();
  const [name, setName] = useState(recipe?.name ?? "");
  const [aliases, setAliases] = useState(recipe?.aliases.join(", ") ?? "");
  const [lines, setLines] = useState<Array<{ itemId: string; qty: string }>>(recipe ? recipe.lines.map((l) => ({ itemId: l.itemId, qty: String(l.qty) })) : [{ itemId: "", qty: "" }]);
  const setLine = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((p) => p.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const unitOf = (id: string) => data.items.find((i) => i.id === id)?.unit ?? "";
  return (
    <Drawer isOpen onOpenChange={(o) => { if (!o) onClose(); }} title={recipe ? `Sửa công thức ${recipe.name}` : "Thêm công thức"} description="Một ly, một phần hoặc một liệu trình dùng bao nhiêu nguyên liệu. Khi đơn được xác nhận, kho tự trừ nguyên liệu." closeLabel="Đóng" placement="right">
      <div className={FORM_CLASS_NAME}>
        <Input id="rc-name" name="name" label="Tên món hoặc dịch vụ" hint="Đúng như tên trên đơn hàng, ví dụ: cà phê sữa" variant="secondary" isRequired value={name} onValueChange={setName} />
        <Input id="rc-alias" name="aliases" label="Tên gọi khác" hint="Cách nhau bằng dấu phẩy" variant="secondary" value={aliases} onValueChange={setAliases} />
        <Text weight="semibold">Nguyên liệu cho 1 phần</Text>
        {lines.map((l, i) => (
          <div key={i} className={LINE_ROW_CLASS_NAME}>
            <Select label={`Nguyên liệu ${i + 1}`} placeholder="Chọn hàng" value={l.itemId || null} options={data.items.filter((x) => x.active).map((x) => ({ id: x.id, label: `${x.name} (${x.unit})` }))} onValueChange={(v) => setLine(i, { itemId: v ?? "" })} />
            <Input id={`rl-q-${i}`} name={`rq-${i}`} label={`Số lượng${l.itemId ? ` (${unitOf(l.itemId)})` : ""}`} variant="secondary" value={l.qty} onValueChange={(v) => setLine(i, { qty: v })} />
            <Button variant="ghost" size="sm" onPress={() => setLines((p) => p.filter((_, n) => n !== i))}>Bỏ</Button>
          </div>
        ))}
        <div><Button variant="ghost" size="sm" onPress={() => setLines((p) => [...p, { itemId: "", qty: "" }])}>Thêm nguyên liệu</Button></div>
        <Feedback error={run.error} notice={run.notice} />
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="primary" isPending={run.isPending} onPress={() => run.exec(() => saveRecipe({ id: recipe?.id, name, aliases, lines }), () => { onClose(); })}>Lưu</Button>
          {recipe ? <Button variant="danger-soft" isDisabled={run.isPending} onPress={() => run.exec(() => deleteRecipe(recipe.id), () => { onClose(); })}>Xoá công thức</Button> : null}
        </div>
      </div>
    </Drawer>
  );
};

export const RecipesPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const [editing, setEditing] = useState<RecipeView | "new" | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {data.canManage ? <div><Button variant="primary" size="sm" isDisabled={data.items.length === 0} onPress={() => setEditing("new")}>Thêm công thức</Button></div> : null}
      <SurfaceCard ariaLabel="Công thức">
        {data.recipes.length === 0 ? <EmptyNotice message="Chưa có công thức" description="Dành cho quán cà phê, spa, xưởng: món bán ra gồm nhiều nguyên liệu. Hàng bán nguyên món thì không cần." /> : (
          <ul className={LIST_CLASS_NAME}>
            {data.recipes.map((r) => (
              <li key={r.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <Text weight="semibold">1 {r.name}</Text>
                  <Text size="sm" tone="muted">{r.lines.map((l) => `${formatQty(l.qty)} ${l.unit} ${l.name}`).join(" + ")}</Text>
                </div>
                {data.canManage ? <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="outline" size="sm" onPress={() => setEditing(r)}>Sửa</Button></div> : null}
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      {editing !== null ? <RecipeDrawer key={editing === "new" ? "new" : editing.id} recipe={editing === "new" ? null : editing} data={data} onClose={() => setEditing(null)} /> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ import and templates */

export const ImportPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const run = useRun();
  const [text, setText] = useState("");
  if (!data.canManage) return <SurfaceCard ariaLabel="Nhập dữ liệu"><EmptyNotice message="Chỉ chủ hoặc quản lý nhập dữ liệu" description="Bạn vẫn kiểm kê và chỉnh tồn được ở các tab khác." /></SurfaceCard>;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SurfaceCard ariaLabel="Dán bảng hàng hoá">
        <div className={FORM_CLASS_NAME}>
          <Text weight="semibold">Dán bảng từ Excel hoặc CSV</Text>
          <Text size="sm" tone="muted">Sao chép các dòng từ bảng tính rồi dán vào đây. Dòng đầu nên có tên cột (Tên, Đơn vị, Nhóm, Giá vốn, Giá bán, Tồn tối thiểu, Số lượng nhập, Tồn, Nhà cung cấp, Mã). Không có dòng tên cột thì NIVO đọc theo thứ tự: mã, tên, đơn vị, nhóm, giá vốn, giá bán, tồn tối thiểu, số lượng nhập, tồn, nhà cung cấp. Mã đã có thì cập nhật, chưa có thì thêm mới.</Text>
          <Textarea label="Bảng hàng hoá" isLabelHidden rows={8} placeholder={"Tên\tĐơn vị\tGiá vốn\tTồn tối thiểu\tTồn\tNhà cung cấp\nCà phê hạt\tg\t250\t2000\t6000\tPhú Lộc"} value={text} onValueChange={setText} />
          <Feedback error={run.error} notice={run.notice} />
          <div><Button variant="primary" isPending={run.isPending} isDisabled={!text.trim()} onPress={() => run.exec(() => importPasteAction(text), (r) => { setText(""); return `Đã nhập: ${r.created} hàng mới, ${r.updated} cập nhật, ${r.stocked} có số tồn đầu kỳ${r.skipped.length ? `; bỏ ${r.skipped.length} dòng không có tên` : ""}.`; })}>Nhập vào kho</Button></div>
        </div>
      </SurfaceCard>
      <SurfaceCard ariaLabel="Nạp mẫu theo ngành">
        <div className={FORM_CLASS_NAME}>
          <Text weight="semibold">Bắt đầu nhanh theo ngành</Text>
          <Text size="sm" tone="muted">Nạp sẵn danh sách hàng, nhà cung cấp và công thức mẫu để bạn sửa lại cho đúng quán. Mã hàng đã có thì giữ nguyên.</Text>
          <ul className={LIST_CLASS_NAME}>
            {data.templates.map((t) => (
              <li key={t.key} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}><Text weight="semibold">{t.name}</Text><Text size="sm" tone="muted">{t.description}</Text></div>
                <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="outline" size="sm" isDisabled={run.isPending} onPress={() => run.exec(() => loadTemplateAction(t.key), (r) => `Đã nạp ${r.items} mặt hàng, ${r.suppliers} nhà cung cấp, ${r.recipes} công thức.`)}>Nạp mẫu</Button></div>
              </li>
            ))}
          </ul>
        </div>
      </SurfaceCard>
    </div>
  );
};

/* ------------------------------------------------------------------ stock-take (made for a phone) */

export const CountPanel = ({ data }: { readonly data: InventoryWorkbench }) => {
  const run = useRun();
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const rows = data.items.filter((i) => i.active && (!q.trim() || `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  const entered = Object.entries(counts).filter(([, v]) => v.trim() !== "" && Number.isFinite(num(v, NaN)));
  const submit = () => run.exec(
    () => stockTakeAction(entered.map(([itemId, v]) => ({ itemId, counted: num(v) }))),
    (r) => { setCounts({}); return `Đã ghi kiểm kê: ${r.applied} mặt hàng đã chỉnh, ${r.same} khớp số máy${r.waiting ? `, ${r.waiting} chênh lệch lớn đang chờ bạn duyệt` : ""}.`; },
  );
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Text size="sm" tone="muted">Đếm từng mặt hàng rồi nhập số đếm được. Ô để trống là chưa đếm. Món nào lệch ít thì chỉnh ngay; lệch nhiều thì chờ chủ duyệt.</Text>
      <SearchField label="Tìm hàng" isLabelHidden placeholder="Tìm hàng để đếm" clearLabel="Xoá tìm kiếm" value={q} onValueChange={setQ} onClear={() => setQ("")} />
      <SurfaceCard ariaLabel="Kiểm kê">
        {rows.length === 0 ? <EmptyNotice message="Chưa có hàng để kiểm kê" description="Thêm hàng ở tab Tồn kho hoặc Nhập dữ liệu." /> : (
          <ul className={LIST_CLASS_NAME} aria-label="Hàng cần đếm">
            {rows.map((i) => (
              <li key={i.id} className={COUNT_ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <Text weight="semibold" overflow="clamp-2">{i.name}</Text>
                  <Text size="xs" tone="muted">Máy ghi {formatQty(i.total)} {i.unit}</Text>
                </div>
                <div className={COUNT_FIELD_CLASS_NAME}>
                  <Input id={`cnt-${i.id}`} name={`cnt-${i.id}`} label={`Đếm (${i.unit})`} variant="secondary" placeholder={i.unit} value={counts[i.id] ?? ""} onValueChange={(v) => setCounts((p) => ({ ...p, [i.id]: v }))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      <Feedback error={run.error} notice={run.notice} />
      <div><Button variant="primary" isPending={run.isPending} isDisabled={entered.length === 0} onPress={submit}>Ghi kết quả kiểm kê ({entered.length})</Button></div>
    </div>
  );
};
