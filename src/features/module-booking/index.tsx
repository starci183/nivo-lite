import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { workbenchBooking } from "@/i18n/dict/workbenchBooking";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { workbenchHref } from "@/lib/agent-dashboard-shared";
import { loadWorkbenchData, type WorkbenchData } from "@/lib/module-booking-view";
import { getSession } from "@/lib/session";
import { loadBookingFigures, type BookingFigures } from "@/lib/workbench-booking";
import { BookingWorkbenchView } from "./view";

/** Props for {@link WorkbenchBooking}. */
export type BookingWorkbenchProps = {
  /** `?tab=` from the route (calendar, today, waitlist, stats, setup); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** /m/booking/workbench: the agent dashboard frame around the calendar by resource, today's list, waiting list, statistics and the setup of services, resources and policy. */
const WorkbenchBooking = async ({ tab = null }: BookingWorkbenchProps = {}) => {
  const t = await getT(workbenchBooking);
  // A waiting booking item is a request to decide on the calendar (the "Lịch" tab lists the requested bookings first).
  const dashboard = loadAgentDashboard("booking", { decisionHref: (item) => workbenchHref("booking", { tab: "calendar", focus: item.id }) });
  let data: WorkbenchData | null = null;
  let figures: BookingFigures | null = null;
  try {
    const session = await getSession();
    const ws = session.workspace.id;
    data = await loadWorkbenchData(ws);
    try {
      figures = await loadBookingFigures(ws);
    } catch (e) {
      console.error("booking figures failed", e instanceof Error ? e.message : e);
    }
  } catch (e) {
    console.error("booking workbench failed", e instanceof Error ? e.message : e);
  }
  if (!data) {
    return (
      <AgentDashboardFrame
        module="booking"
        data={await dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "calendar",
          label: t("tabCalendar"),
          content: (
            <SurfaceCard ariaLabel={t("loadFailedTitle")}>
              <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }
  return <BookingWorkbenchView initial={data} figures={figures} dashboard={await dashboard} initialTab={tab} />;
};

export default WorkbenchBooking;
