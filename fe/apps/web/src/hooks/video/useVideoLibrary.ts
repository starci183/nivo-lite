"use client"
import { mapSlot, slotOfReads, slotOfSwr } from "@/hooks/slot"
import { useQueryVideoProjectsSwr } from "@/hooks/swr"
import { useVideoBrandKit } from "./useVideoBrandKit"
import { useVideoReferences } from "./useVideoReferences"
import { projectViewOf } from "./video.shared"

/** The normal library joins real kit/projects; its figures keep their own independent failure and retry. */
export const useVideoLibrary = (isActive = true) => {
    const kit = useVideoBrandKit(isActive),
        projects = useQueryVideoProjectsSwr(false, isActive),
        references = useVideoReferences(isActive, false, true)
    const slot = slotOfReads([...kit.reads, projects], () => {
        if (kit.data === undefined || projects.data === undefined)
            throw new Error("A ready video library requires its actual kit and projects")
        return { ...kit.data, projects: projects.data.map(projectViewOf) }
    })
    return {
        slot,
        data: "items" in slot ? slot.items : undefined,
        figures: references.figures,
        figuresSlot: mapSlot(slotOfSwr(references.reads.figures), () => references.figures),
        retryFigures: () => references.reads.figures.mutate(),
        reload: () => Promise.all([kit.reload(), projects.mutate()]),
    }
}
