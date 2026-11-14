import { createViewerCache, type ViewerCache } from "@starci/next-data"

/** The writes to the cache of the viewer on screen: each viewer has their own, so the mutate SWR exports, bound to its default cache, reaches none of them. */
export const viewerCache: ViewerCache = createViewerCache()

/** Refreshes or writes entries of the viewer's cache, the way SWR's own `mutate` does for its default cache. */
export const mutate: ViewerCache["mutate"] = viewerCache.mutate
