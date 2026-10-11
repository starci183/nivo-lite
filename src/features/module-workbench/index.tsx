import { SurfaceCard, Skeleton } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { moduleDef } from "@/lib/module-registry";
import type { ModuleKey } from "@/lib/modules-shared";
import { WORKBENCHES } from "./registry";
import { WorkbenchPending } from "./WorkbenchPending";

/**
 * The workbench slot of /m/<module>/workbench: renders the module's own workbench from the registry map, or the "Đang hoàn thiện" state when it has none yet.
 * STATE-8: with `isLoading` it is the slot's own card with its content as a skeleton (each workbench owns its content, so none of them is drawn).
 */
export const ModuleWorkbench = async ({ module, isLoading = false }: { readonly module: ModuleKey; readonly isLoading?: boolean }) => {
  if (isLoading) {
    const t = await getT(modulesCore);
    return <SurfaceCard ariaLabel={t("workbenchTitle")}><Skeleton shape="text" lines={4} /></SurfaceCard>;
  }
  const key = moduleDef(module).workbench;
  const Workbench = key === null ? undefined : WORKBENCHES[key];
  return Workbench === undefined ? <WorkbenchPending module={module} /> : <Workbench />;
};
