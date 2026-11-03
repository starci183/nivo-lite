import { viewerKeyId } from "@starci/next-data"
import { useViewerId } from "./useViewerId"

/** The viewer part of a viewer-scoped SWR key: the user id, `"signed-out"` without a session, undefined until the session answer lands. */
export const useViewerKeyId = (): string | undefined => viewerKeyId(useViewerId())
