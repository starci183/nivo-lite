"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, DescriptionList, EmptyNotice, ListItem, SectionHeader, SurfaceCard, SurfaceListCard, Tabs, Text } from "@starci/grammar/common";
import { decideWorkItem } from "@/lib/flow-actions";
import { formatMoney } from "@/lib/module-inventory-shared";
import type { InventoryWorkbench, PendingView } from "@/lib/module-inventory-queries";
import {
  PAGE_CLASS_NAME, PANEL_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, STACK_CLASS_NAME,
} from "./classNames";
import { CountPanel, HistoryPanel, ImportPanel, RecipesPanel, SuppliersPanel } from "./more";
import { OrdersPanel } from "./orders";
import { Feedback, useRun } from "./parts";
import { StockPanel } from "./stock";

type TabId = "stock" | "orders" | "suppliers" | "history" | "recipes" | "count" | "import";
const TABS: ReadonlyArray<{ readonly id: TabId; readonly label: string }> = [
  { id: "stock", label: "Tồn kho" }, { id: "orders", label: "Đơn nhập" }, { id: "suppliers", label: "NCC & kho" }, { id: "history", label: "Lịch sử" },
  { id: "recipes", label: "Công thức" }, { id: "count", label: "Kiểm kê" }, { id: "import", label: "Nhập dữ liệu" },
];
const isTab = (v: string | null | undefined): v is TabId => !!v && TABS.some((t) => t.id === v);

/** What waits for the owner: sending an order to a supplier and bigger stock changes (the authority gate). */
const PendingList = ({ rows, onOpenOrders }: { readonly rows: ReadonlyArray<PendingView>; readonly onOpenOrders: () => void }) => {
  const run = useRun();
  if (rows.length === 0) return null;
  const decide = (id: string, outcome: "approved" | "rejected") => run.exec(() => decideWorkItem(id, outcome, undefined, outcome === "rejected" ? "Từ chối trong màn Kho" : undefined));
  return (
    <div className={STACK_CLASS_NAME}>
      <SectionHeader level={2} title="Chờ bạn duyệt" count={rows.length} description="Gửi đơn cho nhà cung cấp và chỉnh số tồn lớn luôn hỏi bạn trước." />
      <Feedback error={run.error} notice={run.notice} />
      <SurfaceListCard ariaLabel="Chờ bạn duyệt">
        {rows.map((p) => (
          <ListItem key={p.id} className={ROW_CLASS_NAME}>
            <div className={ROW_MAIN_CLASS_NAME}>
              <Text weight="medium">{p.summary}</Text>
              {p.draft ? <div className={QUOTE_CLASS_NAME}><Text size="sm">{p.draft}</Text></div> : null}
            </div>
            <div className={ROW_ACTIONS_CLASS_NAME}>
              <Button variant="primary" size="sm" isDisabled={run.isPending} onPress={() => decide(p.id, "approved")}>{p.action === "send_purchase_order" ? "Duyệt và gửi" : "Duyệt chỉnh tồn"}</Button>
              <Button variant="outline" size="sm" isDisabled={run.isPending} onPress={() => decide(p.id, "rejected")}>Từ chối</Button>
              {p.poId ? <Button variant="ghost" size="sm" onPress={onOpenOrders}>Mở đơn</Button> : null}
            </div>
          </ListItem>
        ))}
      </SurfaceListCard>
    </div>
  );
};

/** The Kho & nhập hàng workbench: four figures, what waits for the owner, then seven surfaces as tabs. */
export const InventoryWorkbenchView = ({ data }: { readonly data: InventoryWorkbench | null }) => {
  const [tab, setTab] = useState<TabId>("stock");
  const select = useCallback((key: string) => {
    if (!isTab(key)) return;
    setTab(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url);
    } catch {
      // the address bar is a convenience only
    }
  }, []);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTab(fromUrl);
  }, []);

  if (!data) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel="Không tải được kho"><EmptyNotice message="Chưa tải được dữ liệu kho" description="Thử tải lại trang sau ít phút." /></SurfaceCard>
      </div>
    );
  }
  const m = data.metrics;
  const alertCount = m.lowCount + m.outCount;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const items = TABS.map((t) => ({ id: t.id, label: t.id === "orders" ? `${t.label}${count(m.openPos)}` : t.label }));
  return (
    <div className={PAGE_CLASS_NAME}>
      <SurfaceCard ariaLabel="Tổng quan kho">
        <DescriptionList
          layout="stat-strip"
          isDivided
          items={[
            { id: "value", term: "Giá trị tồn kho", description: formatMoney(m.valueVnd), meta: `${m.itemCount} mặt hàng, tính theo giá vốn bình quân` },
            { id: "low", term: "Sắp hết", description: m.lowCount > 0 ? <Badge tone="warning" isDot>{String(m.lowCount)}</Badge> : String(m.lowCount), meta: "Đang ở hoặc dưới mức tồn tối thiểu" },
            { id: "out", term: "Hết hàng", description: m.outCount > 0 ? <Badge tone="danger" isDot>{String(m.outCount)}</Badge> : String(m.outCount), meta: "Số lượng bằng 0 hoặc âm" },
            { id: "open", term: "Đơn nhập đang mở", description: m.pendingCount > 0 ? <Badge tone="warning" isDot>{String(m.openPos)}</Badge> : String(m.openPos), meta: m.pendingCount ? `${m.pendingCount} việc chờ bạn duyệt` : "Nháp, chờ duyệt, đã gửi, đang nhận" },
          ]}
        />
      </SurfaceCard>
      {alertCount > 0 && tab !== "stock" ? <Alert tone="cautionary" title={`${alertCount} mặt hàng sắp hết hoặc đã hết. Mở tab Tồn kho để xem.`} /> : null}
      <PendingList rows={data.pending} onOpenOrders={() => select("orders")} />
      <Tabs label="Các mục của kho" selectedKey={tab} items={items} inset="none" labelVisibility="always" panelId={(k) => `inv-panel-${k}`} onSelect={select} />
      <div className={PANEL_CLASS_NAME} role="tabpanel" id={`inv-panel-${tab}`}>
        {tab === "stock" ? <StockPanel data={data} /> : null}
        {tab === "orders" ? <OrdersPanel data={data} /> : null}
        {tab === "suppliers" ? <SuppliersPanel data={data} /> : null}
        {tab === "history" ? <HistoryPanel data={data} /> : null}
        {tab === "recipes" ? <RecipesPanel data={data} /> : null}
        {tab === "count" ? <CountPanel data={data} /> : null}
        {tab === "import" ? <ImportPanel data={data} /> : null}
      </div>
    </div>
  );
};

