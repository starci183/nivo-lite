import { viewerKey } from "@starci/next-data"
import type { KeyOrWait } from "@starci/next-data"
import { useViewerId } from "./useViewerId"

/** The SWR key of a viewer-scoped read: `[name, userId]`; null (the read waits) until the session answer lands. */
export const useViewerKey = (name: string): KeyOrWait<readonly [string, string]> => viewerKey(name, useViewerId())
