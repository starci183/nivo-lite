import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { loadWorkbenchData, type WorkbenchData } from "@/lib/module-booking-view";
import { getSession } from "@/lib/session";
import { BookingWorkbenchView } from "./view";

/** /m/booking/workbench: the calendar by resource, today's list, waiting list, utilisation and the setup of services, resources and policy. */
const WorkbenchBooking = async () => {
  let data: WorkbenchData | null = null;
  try {
    const session = await getSession();
    data = await loadWorkbenchData(session.workspace.id);
  } catch (e) {
    console.error("booking workbench failed", e instanceof Error ? e.message : e);
  }
  if (!data) {
    return (
      <SurfaceCard ariaLabel="Không tải được lịch">
        <EmptyNotice message="Chưa tải được lịch hẹn" description="Bạn thử tải lại trang. Nếu vẫn lỗi, báo cho NIVO." />
      </SurfaceCard>
    );
  }
  return <BookingWorkbenchView initial={data} />;
};

export default WorkbenchBooking;
