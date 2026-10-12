"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchInventory } from "@/i18n/dict/workbenchInventory";

/** STATE-8: the Inventory workbench with no data yet - the frame's own tree, the four figure terms and the seven tab labels real, values and lists as skeleton. */
export const InventoryWorkbenchLoading = () => {
  const t = useT(workbenchInventory);
  return (
    <AgentDashboardFrame
      module="inventory"
      isLoading
      figures={[
        { id: "reorder", term: t("metricReorder"), description: "" },
        { id: "awaiting", term: t("metricAwaiting"), description: "" },
        { id: "value", term: t("metricValue"), description: "" },
        { id: "stockouts", term: t("metricStockOuts"), description: "" },
      ]}
      tabs={[
        { id: "stock", label: t("tabStock") },
        { id: "orders", label: t("tabOrders") },
        { id: "suppliers", label: t("tabSuppliers") },
        { id: "history", label: t("tabHistory") },
        { id: "recipes", label: t("tabRecipes") },
        { id: "count", label: t("tabCount") },
        { id: "import", label: t("tabImport") },
      ]}
    />
  );
};
