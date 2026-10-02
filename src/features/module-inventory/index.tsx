import { getInventoryWorkbench, type InventoryWorkbench } from "@/lib/module-inventory-queries";
import { InventoryWorkbenchView } from "./view";

/** Connected "Kho & nhập hàng" workbench: reads the inventory tables and still renders if they are not ready. */
const WorkbenchInventory = async () => {
  let data: InventoryWorkbench | null = null;
  try {
    data = await getInventoryWorkbench();
  } catch (e) {
    console.error("inventory workbench failed", e instanceof Error ? e.message : e);
  }
  return <InventoryWorkbenchView data={data} />;
};

export default WorkbenchInventory;
