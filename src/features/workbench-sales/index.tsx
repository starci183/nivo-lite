import { getSalesWorkbench, type SalesWorkbenchData } from "@/lib/workbench-sales";
import { SalesWorkbenchView } from "./view";

/** Props for {@link SalesWorkbench}. */
export type SalesWorkbenchProps = {
  /** `?tab=` from the route (attention, pipeline, decisions, handoff, activity); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** Connected Sales workbench: reads the flow data and still renders if the tables are not ready. */
const SalesWorkbench = async ({ tab = null }: SalesWorkbenchProps = {}) => {
  let data: SalesWorkbenchData | null = null;
  try {
    data = await getSalesWorkbench();
  } catch (e) {
    console.error("sales workbench failed", e instanceof Error ? e.message : e);
  }
  return <SalesWorkbenchView data={data} initialTab={tab} />;
};

export default SalesWorkbench;
