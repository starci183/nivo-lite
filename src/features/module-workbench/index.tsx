import type { ModuleKey } from "@/lib/modules-shared";
import WorkbenchAccounting from "@/features/workbench-accounting";
import WorkbenchChatbot from "@/features/workbench-chatbot";
import WorkbenchSales from "@/features/workbench-sales";

/** The workbench slot of /m/<module>/workbench: delegates to the module's own workbench feature. */
export const ModuleWorkbench = ({ module }: { readonly module: ModuleKey }) => {
  switch (module) {
    case "chatbot": return <WorkbenchChatbot />;
    case "sales": return <WorkbenchSales />;
    case "accounting": return <WorkbenchAccounting />;
  }
};
