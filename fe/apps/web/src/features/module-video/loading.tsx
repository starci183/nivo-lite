"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";

/** STATE-8: the Video workbench with no data yet - the frame's own tree, the four figure terms and the two tab labels real, values and lists as skeleton. */
export const VideoWorkbenchLoading = () => {
  const tf = useT(workbenchFigures);
  return (
    <AgentDashboardFrame
      module="video"
      isLoading
      figures={[
        { id: "rendering", term: tf("vdRendering"), description: "" },
        { id: "ready", term: tf("vdReady"), description: "" },
        { id: "published", term: tf("vdPublished"), description: "" },
        { id: "credits", term: tf("vdCredits"), description: "" },
      ]}
      tabs={[
        { id: "library", label: tf("vdTabLibrary") },
        { id: "brand", label: tf("vdTabBrand") },
      ]}
    />
  );
};
