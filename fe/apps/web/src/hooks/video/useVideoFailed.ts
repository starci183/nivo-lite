import { useQueryVideoBrandSwr, useQueryVideoProjectsSwr, useQueryVideoScopeSwr } from "@/hooks/swr"
import { useVideoEditorStep } from "./useVideoEditorStep"
import type { VideoEditorAddress } from "./useVideoEditorStep"

/** Whether the video workbench could not read what the address asks for. */
export const useVideoFailed = (address: VideoEditorAddress): boolean => {
    const scope = useQueryVideoScopeSwr()
    const projects = useQueryVideoProjectsSwr()
    const brand = useQueryVideoBrandSwr()
    const editor = useVideoEditorStep(address)
    return Boolean(scope.error || projects.error || brand.error) || editor.failed
}
