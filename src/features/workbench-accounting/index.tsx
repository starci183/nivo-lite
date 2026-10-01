import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import { getAccountingWorkbench, type AccountingWorkbench } from "@/lib/workbench-accounting";
import { AccountingWorkbenchView } from "./component";

/** Accounting workbench slot of /m/accounting/workbench: reads the flow's own records and renders the four surfaces. */
const Workbench = async () => {
  const t = await getT(workbenchAccounting);
  let data: AccountingWorkbench | null = null;
  try {
    data = await getAccountingWorkbench();
  } catch {
    data = null;
  }
  if (data === null) {
    return (
      <SurfaceCard ariaLabel={t("loadFailedTitle")}>
        <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
      </SurfaceCard>
    );
  }
  return <AccountingWorkbenchView data={data} />;
};

export default Workbench;
