"use client"

import { useTranslations } from "next-intl"
import {
    useMutateArchiveVideoProjectSwr,
    useMutateCreateVideoProjectSwr,
    useMutateDuplicateVideoProjectSwr,
    useMutateUpdateVideoProjectSwr,
} from "@/hooks/swr"
import type { MutateCreateVideoProjectRequest, MutateUpdateVideoProjectRequest } from "@/hooks/swr"
import type { ProjectInputs, ScriptScene } from "@/modules/video"
import { projectCommandOf } from "./video.shared"
import { useVideoRefresh } from "./useVideoRefresh"
import type { VideoOwner } from "./useVideoRefresh"

/** The edits one update sends: the inputs and the scenes arrive as the editor holds them, read-only. */
interface VideoProjectPatch extends Omit<MutateUpdateVideoProjectRequest, "projectId" | "inputs" | "script"> {
    readonly inputs?: ProjectInputs
    readonly script?: ReadonlyArray<ScriptScene>
}

/** Creates, edits, duplicates and archives video projects, reports every outcome, and reads the video data again. */
export const useVideoActions = (owner?: VideoOwner) => {
    const t = useTranslations("video")
    const { complete, isPending } = useVideoRefresh(owner)
    const createMutation = useMutateCreateVideoProjectSwr()
    const updateMutation = useMutateUpdateVideoProjectSwr()
    const duplicateMutation = useMutateDuplicateVideoProjectSwr()
    const archiveMutation = useMutateArchiveVideoProjectSwr()
    const create = (
        request: MutateCreateVideoProjectRequest,
        onResult?: (result: Awaited<ReturnType<typeof createMutation.trigger>> | undefined) => void,
    ) => complete(() => createMutation.trigger(request), t("saved"), onResult)
    const update = (
        projectId: string,
        patch: VideoProjectPatch,
        onResult?: (result: Awaited<ReturnType<typeof updateMutation.trigger>> | undefined) => void,
    ) => {
        const request: MutateUpdateVideoProjectRequest = {
            ...patch,
            projectId,
            inputs: patch.inputs
                ? { ...patch.inputs, sourceIds: [...patch.inputs.sourceIds], media: [...patch.inputs.media] }
                : undefined,
            script: patch.script?.map((scene) => ({ ...scene })),
        }
        return complete(() => updateMutation.trigger(request), t("saved"), onResult)
    }
    const duplicate = projectCommandOf(complete, (projectId) => duplicateMutation.trigger({ projectId }), t("saved"))
    const archive = projectCommandOf(
        complete,
        (projectId) => archiveMutation.trigger({ projectId, archived: true }),
        t("status_archived"),
    )
    return { create, update, duplicate, archive, isPending }
}
