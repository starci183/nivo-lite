"use client"
import { slotOfReads } from "@/hooks/slot"
import { useVideoBrandKit } from "./useVideoBrandKit"
import { useVideoEditorStep } from "./useVideoEditorStep"
import type { VideoEditorAddress } from "./useVideoEditorStep"
import { useVideoReferences } from "./useVideoReferences"
import { goalTemplateOf } from "./video.shared"

/** The editor joins only its actual kit, sources and enabled project read; a new project remains genuinely null. */
export const useVideoEditor = (address: VideoEditorAddress, isActive = true) => {
    const kit = useVideoBrandKit(isActive),
        references = useVideoReferences(isActive, true, false),
        selection = useVideoEditorStep(address, isActive)
    const reads = [...kit.reads, references.reads.sources, ...(selection.isEnabled ? [selection.read] : [])]
    const slot = slotOfReads(reads, () => {
        if (kit.data === undefined || references.reads.sources.data === undefined)
            throw new Error("A ready video editor requires its actual kit and sources")
        const project = selection.project,
            first = goalTemplateOf(project?.goal ?? "service")
        return {
            canEdit: kit.data.canEdit,
            project,
            step: selection.step,
            wizardKey: project?.id ?? "new",
            media: kit.data.media,
            sources: references.sources,
            brand: kit.data.brand,
            goal: {
                projectId: project?.id ?? null,
                goal: project?.goal ?? first.goal,
                aspect: project?.aspect ?? first.default_aspect,
                seconds: project?.targetSeconds ?? first.default_seconds,
                title: project?.title ?? "",
                locked: project?.status === "scripting" || project?.status === "rendering",
            },
        }
    })
    return {
        slot,
        reads,
        step: selection.step,
        data: "items" in slot ? slot.items : undefined,
        reload: () =>
            Promise.all([
                kit.reload(),
                references.reads.sources.mutate(),
                ...(selection.isEnabled ? [selection.read.mutate()] : []),
            ]),
    }
}
