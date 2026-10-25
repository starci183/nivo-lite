import { useViewerId } from "./useViewerId"

/** The viewer part of a viewer-scoped SWR key: the user id, `"signed-out"` without a session, undefined until the session answer lands. */
export const useViewerKeyId = (): string | undefined => {
    const viewerId = useViewerId()
    return viewerId === undefined ? undefined : (viewerId ?? "signed-out")
}
