import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { leadGen as dict } from "@/i18n/dict/leadGen";

/** Workbench slot of /m/lead_gen/workbench: "Tạo lead". Placeholder until the real dashboard lands. */
const WorkbenchLeadGen = async () => {
  const t = await getT(dict);
  return (
    <SurfaceCard ariaLabel={t("placeholderTitle")}>
      <EmptyNotice message={t("placeholderTitle")} description={t("placeholderBody")} />
    </SurfaceCard>
  );
};

export default WorkbenchLeadGen;
