"use client";

import { Button, EmptyNotice, ListItem, SectionHeader, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchInventory } from "@/i18n/dict/workbenchInventory";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import { decideWorkItem } from "@/lib/flow-actions";
import { formatMoney } from "@/lib/module-inventory-shared";
import type { InventoryWorkbench, PendingView } from "@/lib/module-inventory-queries";
import type { InventoryFigures } from "@/lib/workbench-inventory";
import { QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, STACK_CLASS_NAME } from "./classNames";
import { CountPanel, HistoryPanel, ImportPanel, RecipesPanel, SuppliersPanel } from "./more";
import { OrdersPanel } from "./orders";
import { Feedback, useRun } from "./parts";
import { StockPanel } from "./stock";

/** What waits for the owner: sending an order to a supplier and bigger stock changes (the authority gate). It leads the Purchase orders tab, where the "Chờ bạn" rows land. */
const PendingList = ({ rows }: { readonly rows: ReadonlyArray<PendingView> }) => {
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
            </div>
          </ListItem>
        ))}
      </SurfaceListCard>
    </div>
  );
};

/** Props for {@link InventoryWorkbenchView}. */
export type InventoryWorkbenchViewProps = {
  /** Null when the inventory tables could not be read: the ribbon fails in place and the only tab says so. */
  readonly data: InventoryWorkbench | null;
  readonly figures: InventoryFigures | null;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** `?tab=` of the route, read on the server. */
  readonly initialTab: string | null;
};

/** The Kho & nhập hàng workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the seven inventory surfaces as tabs. */
export const InventoryWorkbenchView = ({ data, figures, dashboard, initialTab }: InventoryWorkbenchViewProps) => {
  const t = useT(workbenchInventory);
  if (!data || !figures) {
    return (
      <AgentDashboardFrame
        module="inventory"
        data={dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "stock",
          label: t("tabStock"),
          content: <SurfaceCard ariaLabel={t("loadFailedTitle")}><EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} /></SurfaceCard>,
        }]}
      />
    );
  }
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  return (
    <AgentDashboardFrame
      module="inventory"
      data={dashboard}
      initialTab={initialTab}
      figures={[
        { id: "reorder", term: t("metricReorder"), description: String(figures.belowReorder), meta: t("metricReorderBasis", { n: figures.itemsTracked }) },
        { id: "awaiting", term: t("metricAwaiting"), description: String(figures.posAwaiting), meta: t("metricAwaitingBasis") },
        { id: "value", term: t("metricValue"), description: formatMoney(figures.valueVnd), meta: t("metricValueBasis") },
        { id: "stockouts", term: t("metricStockOuts"), description: figures.stockOuts7d === null ? "—" : String(figures.stockOuts7d), meta: figures.stockOuts7d === null ? t("metricStockOutsUnknown") : t("metricStockOutsBasis") },
      ]}
      tabs={[
        { id: "stock", label: t("tabStock"), content: <StockPanel data={data} /> },
        {
          id: "orders",
          label: `${t("tabOrders")}${count(data.metrics.openPos)}`,
          content: (
            <>
              <PendingList rows={data.pending} />
              <OrdersPanel data={data} />
            </>
          ),
        },
        { id: "suppliers", label: t("tabSuppliers"), content: <SuppliersPanel data={data} /> },
        { id: "history", label: t("tabHistory"), content: <HistoryPanel data={data} /> },
        { id: "recipes", label: t("tabRecipes"), content: <RecipesPanel data={data} /> },
        { id: "count", label: t("tabCount"), content: <CountPanel data={data} /> },
        { id: "import", label: t("tabImport"), content: <ImportPanel data={data} /> },
      ]}
    />
  );
};
