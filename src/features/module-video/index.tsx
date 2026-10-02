import { getCurrentMember, isManagerRole } from "@/lib/members";
import { listMedia, listProjects, loadBrand, sourceChoices, type VideoCtx } from "@/lib/module-video-core";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Snapshot } from "./actions";
import { VideoWorkbenchView } from "./view";

/** The "Tạo video" workbench (/m/video/workbench): the library of the workspace's videos and the wizard that makes a new one. */
const WorkbenchVideo = async () => {
  const member = await getCurrentMember();
  const c: VideoCtx = { db: supabaseAdmin(), ws: member.workspaceId, userId: member.userId, actor: member.displayName };
  let snapshot: Snapshot | null = null;
  try {
    const [projects, brand, sources, media] = await Promise.all([listProjects(c), loadBrand(c), sourceChoices(c), listMedia(c)]);
    snapshot = { projects, brand, sources, media };
  } catch (e) {
    console.error("video workbench failed", e instanceof Error ? e.message : e);
  }
  return <VideoWorkbenchView initial={snapshot} canEdit={isManagerRole(member.role)} />;
};

export default WorkbenchVideo;
