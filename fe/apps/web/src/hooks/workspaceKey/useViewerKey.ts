import { useViewerId } from "./useViewerId"

/** The SWR key of a viewer-scoped read: `[name, userId]`; null (the read waits) until the session answer lands. */
export const useViewerKey = (name: string): readonly [string, string] | null => {
    const viewerId = useViewerId()
    return viewerId === undefined ? null : [name, viewerId ?? "signed-out"]
}
