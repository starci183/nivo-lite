import { getLoyaltyWorkbench, type LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { LoyaltyWorkbenchView } from "./view";

/** Connected loyalty workbench: reads the programme data and still renders if the tables are not ready. */
const WorkbenchLoyalty = async () => {
  let data: LoyaltyWorkbenchData | null = null;
  try {
    data = await getLoyaltyWorkbench();
  } catch (e) {
    console.error("loyalty workbench failed", e instanceof Error ? e.message : e);
  }
  return <LoyaltyWorkbenchView data={data} />;
};

export default WorkbenchLoyalty;
