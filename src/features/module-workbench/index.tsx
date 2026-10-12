import { moduleDef } from "@/lib/module-registry";
import type { ModuleKey } from "@/lib/modules-shared";
import { WORKBENCHES } from "./registry";
import { WorkbenchPending } from "./WorkbenchPending";

/** Props for {@link ModuleWorkbench}. */
export type ModuleWorkbenchProps = {
  readonly module: ModuleKey;
  /** `?tab=` of the route: the workbench area to open (the agent dashboard frame validates it). */
  readonly tab?: string | null;
  /** `?focus=` of the route: the record a "Chờ bạn" row leads to (see workbenchHref in lib/agent-dashboard-shared). */
  readonly focus?: string | null;
};

/**
 * The workbench slot of /m/<module>/workbench: renders the module's own workbench from the registry map, or the "Đang hoàn thiện" state when it has none yet.
 * STATE-8: the loading view is loading.tsx (a client component that draws the module's own frame with `isLoading`; see ./loading).
 */
export const ModuleWorkbench = async ({ module, tab = null, focus = null }: ModuleWorkbenchProps) => {
  const key = moduleDef(module).workbench;
  const Workbench = key === null ? undefined : WORKBENCHES[key];
  return Workbench === undefined ? <WorkbenchPending module={module} /> : <Workbench tab={tab} focus={focus} />;
};
