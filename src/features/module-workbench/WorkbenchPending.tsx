import { Button, EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { tabHref } from "@/features/modules-core/meta";
import type { ModuleKey } from "@/lib/modules-shared";

/** What a module without a workbench yet shows: a clean "Đang hoàn thiện" state that points to the Setup tab. */
export const WorkbenchPending = async ({ module }: { readonly module: ModuleKey }) => {
  const t = await getT(modulesCore);
  return (
    <SurfaceCard ariaLabel={t("workbenchTitle")}>
      <EmptyNotice message={t("workbenchTitle")} description={t("workbenchBody")} />
      <Button variant="secondary" href={tabHref(module, "setup")}>{t("workbenchSetup")}</Button>
    </SurfaceCard>
  );
};
