import { useViewerKeyId } from "./useViewerKeyId"

/** The SWR key of a viewer-scoped read: `[name, userId]`; null (the read waits) until the session answer lands. */
export const useViewerKey = (name: string): readonly [string, string] | null => {
    const viewerKeyId = useViewerKeyId()
    return viewerKeyId === undefined ? null : [name, viewerKeyId]
}
