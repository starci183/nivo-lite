import { getContentWorkbench, type ContentWorkbenchData } from "@/lib/module-content-data";
import { ContentWorkbenchView } from "./view";

/** Connected Content workbench (/m/content/workbench): reads the content tables with the member's session and still renders if they are not ready. */
const WorkbenchContent = async () => {
  let data: ContentWorkbenchData | null = null;
  try {
    data = await getContentWorkbench();
  } catch (e) {
    console.error("content workbench failed", e instanceof Error ? e.message : e);
  }
  return <ContentWorkbenchView data={data} initialTab={null} />;
};

export default WorkbenchContent;
