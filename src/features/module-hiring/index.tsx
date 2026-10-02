import { getHiringWorkbench, type HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { HiringWorkbenchView } from "./view";

/** Connected Hiring workbench (/m/hiring/workbench): reads with the signed-in manager's own client and still renders if the tables are not ready. */
const WorkbenchHiring = async () => {
  let data: HiringWorkbenchData | null = null;
  let failed = false;
  try {
    data = await getHiringWorkbench();
  } catch (e) {
    failed = true;
    console.error("hiring workbench failed", e instanceof Error ? e.message : e);
  }
  return <HiringWorkbenchView data={data} failed={failed} />;
};

export default WorkbenchHiring;
