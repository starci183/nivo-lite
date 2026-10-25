import { useAppSelector } from "@/redux"

/**
 * The id of the person the browser session belongs to: `undefined` until the first answer, `null` when signed out.
 * Written by AuthSideEffect from the session subscription; drives the per-viewer SWR cache and the keys of
 * viewer-scoped reads.
 */
export const useViewerId = (): string | null | undefined => useAppSelector((state) => state.viewer.viewerId)
