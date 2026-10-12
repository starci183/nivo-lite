import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { getT } from "@/i18n/server";
import { video } from "@/i18n/dict/video";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";
import { loadAgentDashboard } from "@/lib/agent-dashboard";
import { getCurrentMember, isManagerRole } from "@/lib/members";
import { listMedia, listProjects, loadBrand, sourceChoices, type VideoCtx } from "@/lib/module-video-core";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getVideoFigures } from "@/lib/workbench-video";
import type { Snapshot } from "./actions";
import { VideoWorkbenchView } from "./view";

/** Props for {@link WorkbenchVideo}. */
export type VideoWorkbenchProps = {
  /** `?tab=` from the route (library, brand); anything else opens the first tab. */
  readonly tab?: string | null;
};

/** The "Tạo video" workbench (/m/video/workbench): the agent dashboard frame around the library of the workspace's videos and the brand kit; the wizard that makes a video takes the page over. */
const WorkbenchVideo = async ({ tab = null }: VideoWorkbenchProps = {}) => {
  const t = await getT(video);
  const tf = await getT(workbenchFigures);
  const member = await getCurrentMember();
  const c: VideoCtx = { db: supabaseAdmin(), ws: member.workspaceId, userId: member.userId, actor: member.displayName };
  // Every waiting video item is a publish decision: the default link (the workbench focused on the item) is right, the library tab is where it lives.
  const dashboard = loadAgentDashboard("video");
  const figures = getVideoFigures(c.db, c.ws).catch((e: unknown) => { console.error("video figures failed", e instanceof Error ? e.message : e); return null; });
  let snapshot: Snapshot | null = null;
  try {
    const [projects, brand, sources, media] = await Promise.all([listProjects(c), loadBrand(c), sourceChoices(c), listMedia(c)]);
    snapshot = { projects, brand, sources, media };
  } catch (e) {
    console.error("video workbench failed", e instanceof Error ? e.message : e);
  }
  if (snapshot === null) {
    return (
      <AgentDashboardFrame
        module="video"
        data={await dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "library",
          label: tf("vdTabLibrary"),
          content: (
            <SurfaceCard ariaLabel={t("loadFailedTitle")}>
              <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }
  return <VideoWorkbenchView initial={snapshot} canEdit={isManagerRole(member.role)} dashboard={await dashboard} figures={await figures} initialTab={tab} />;
};

export default WorkbenchVideo;
