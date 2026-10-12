"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";

/** STATE-8: the Hiring workbench with no data yet - the frame's own tree, the four figure terms and the six tab labels real, values and lists as skeleton. */
export const HiringWorkbenchLoading = () => {
  const tf = useT(workbenchFigures);
  return (
    <AgentDashboardFrame
      module="hiring"
      isLoading
      figures={[
        { id: "roles", term: tf("hrRoles"), description: "" },
        { id: "pipeline", term: tf("hrPipeline"), description: "" },
        { id: "interviews", term: tf("hrInterviews"), description: "" },
        { id: "offers", term: tf("hrOffers"), description: "" },
      ]}
      tabs={[
        { id: "jobs", label: tf("hrTabJobs") },
        { id: "candidates", label: tf("hrTabCandidates") },
        { id: "interviews", label: tf("hrTabInterviews") },
        { id: "offers", label: tf("hrTabOffers") },
        { id: "onboarding", label: tf("hrTabOnboarding") },
        { id: "settings", label: tf("hrTabSettings") },
      ]}
    />
  );
};
