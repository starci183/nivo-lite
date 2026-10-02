import type { ReactNode } from "react";
import WorkbenchContent from "@/features/module-content";
import WorkbenchInventory from "@/features/module-inventory";
import WorkbenchAccounting from "@/features/workbench-accounting";
import WorkbenchChatbot from "@/features/workbench-chatbot";
import WorkbenchSales from "@/features/workbench-sales";

/** A workbench is a server component (it may be async); it takes no props. */
export type WorkbenchComponent = (props: Record<string, unknown>) => ReactNode | Promise<ReactNode>;

/**
 * Workbench registry: "workbench" key of resources/modules/<key>/module.json -> the module's own working screen.
 * A new module adds ONE line here (and sets "workbench" in its module.json). A module without a line shows the "Đang hoàn thiện" state.
 */
export const WORKBENCHES: Readonly<Record<string, WorkbenchComponent>> = {
  chatbot: WorkbenchChatbot,
  sales: WorkbenchSales,
  accounting: WorkbenchAccounting,
  content: WorkbenchContent,
  inventory: WorkbenchInventory,
};
