import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { getInventoryWorkbench, type InventoryWorkbench } from "@/lib/module-inventory-queries";
import { inventoryFigures } from "@/lib/workbench-inventory";
import { InventoryWorkbenchView } from "./view";

/** Props for {@link WorkbenchInventory}. */
export type InventoryWorkbenchProps = {
  /** `?tab=` from the route (stock, orders, suppliers, history, recipes, count, import); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** Connected "Kho & nhập hàng" workbench: the agent dashboard frame around the inventory data; it still renders if the tables are not ready. */
const WorkbenchInventory = async ({ tab = null }: InventoryWorkbenchProps = {}) => {
  // Every waiting inventory item (send a purchase order, adjust stock) is decided from the top of the Purchase orders tab.
  const dashboard = loadAgentDashboard("inventory", { decisionHref: (item) => workbenchHref("inventory", { tab: "orders", focus: item.id }) });
  let data: InventoryWorkbench | null = null;
  try {
    data = await getInventoryWorkbench();
  } catch (e) {
    console.error("inventory workbench failed", e instanceof Error ? e.message : e);
  }
  return <InventoryWorkbenchView data={data} figures={data ? await inventoryFigures(data) : null} dashboard={await dashboard} initialTab={tab} />;
};

export default WorkbenchInventory;
