import { moduleDef } from "@/lib/module-registry";
import type { ModuleKey } from "@/lib/modules-shared";
import { WORKBENCHES } from "./registry";
import { WorkbenchPending } from "./WorkbenchPending";

/** The workbench slot of /m/<module>/workbench: renders the module's own workbench from the registry map, or the "Đang hoàn thiện" state when it has none yet. */
export const ModuleWorkbench = ({ module }: { readonly module: ModuleKey }) => {
  const key = moduleDef(module).workbench;
  const Workbench = key === null ? undefined : WORKBENCHES[key];
  return Workbench === undefined ? <WorkbenchPending module={module} /> : <Workbench />;
};
