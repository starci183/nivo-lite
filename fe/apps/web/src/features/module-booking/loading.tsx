"use client";

import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchBooking } from "@/i18n/dict/workbenchBooking";

/** STATE-8: the Booking workbench with no data yet - the frame's own tree, the four figure terms and the five tab labels real, values and lists as skeleton. */
export const BookingWorkbenchLoading = () => {
  const t = useT(workbenchBooking);
  return (
    <AgentDashboardFrame
      module="booking"
      isLoading
      figures={[
        { id: "today", term: t("metricToday"), description: "" },
        { id: "noShow", term: t("metricNoShow"), description: "" },
        { id: "utilisation", term: t("metricUtilisation"), description: "" },
        { id: "deposits", term: t("metricDeposits"), description: "" },
      ]}
      tabs={[
        { id: "calendar", label: t("tabCalendar") },
        { id: "today", label: t("tabToday") },
        { id: "waitlist", label: t("tabWaitlist") },
        { id: "stats", label: t("tabStats") },
        { id: "setup", label: t("tabSetup") },
      ]}
    />
  );
};
