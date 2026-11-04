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

/** A command's answer: the saved project, or nothing when the command did not go through. */
type Saved<Project> = Promise<Project | undefined>
type CreatedProject = Awaited<ReturnType<ReturnType<typeof useMutateCreateVideoProjectSwr>["trigger"]>>
type UpdatedProject = Awaited<ReturnType<ReturnType<typeof useMutateUpdateVideoProjectSwr>["trigger"]>>
type DuplicatedProject = Awaited<ReturnType<ReturnType<typeof useMutateDuplicateVideoProjectSwr>["trigger"]>>
type ArchivedProject = Awaited<ReturnType<ReturnType<typeof useMutateArchiveVideoProjectSwr>["trigger"]>>

type UseVideoActionsResult = {
    create: (
        request: MutateCreateVideoProjectRequest,
        onResult?: (result: CreatedProject | undefined) => void,
    ) => Saved<CreatedProject>
    update: (
        projectId: string,
        patch: VideoProjectPatch,
        onResult?: (result: UpdatedProject | undefined) => void,
    ) => Saved<UpdatedProject>
    duplicate: (
        projectId: string,
        onResult?: (result: DuplicatedProject | undefined) => void,
    ) => Saved<DuplicatedProject>
    archive: (projectId: string, onResult?: (result: ArchivedProject | undefined) => void) => Saved<ArchivedProject>
    isPending: boolean
}

/** The request one update sends: the read-only editor values copied into the mutable shapes the API takes. */
const updateRequestOf = (projectId: string, patch: VideoProjectPatch): MutateUpdateVideoProjectRequest => ({
    ...patch,
    projectId,
    inputs: patch.inputs
        ? { ...patch.inputs, sourceIds: [...patch.inputs.sourceIds], media: [...patch.inputs.media] }
        : undefined,
    script: patch.script?.map((scene) => ({ ...scene })),
})

/** Creates, edits, duplicates and archives video projects, reports every outcome, and reads the video data again. */
export const useVideoActions = (owner?: VideoOwner): UseVideoActionsResult => {
    const t = useTranslations("video")
    const { complete, isPending } = useVideoRefresh(owner)
    const createMutation = useMutateCreateVideoProjectSwr()
    const updateMutation = useMutateUpdateVideoProjectSwr()
    const duplicateMutation = useMutateDuplicateVideoProjectSwr()
    const archiveMutation = useMutateArchiveVideoProjectSwr()
    const create = (
        request: MutateCreateVideoProjectRequest,
        onResult?: (result: CreatedProject | undefined) => void,
    ): Saved<CreatedProject> => complete(() => createMutation.trigger(request), t("saved"), onResult)
    const update = (
        projectId: string,
        patch: VideoProjectPatch,
        onResult?: (result: UpdatedProject | undefined) => void,
    ): Saved<UpdatedProject> =>
        complete(() => updateMutation.trigger(updateRequestOf(projectId, patch)), t("saved"), onResult)
    const duplicate = projectCommandOf(complete, (projectId) => duplicateMutation.trigger({ projectId }), t("saved"))
    const archive = projectCommandOf(
        complete,
        (projectId) => archiveMutation.trigger({ projectId, archived: true }),
        t("status_archived"),
    )
    return { create, update, duplicate, archive, isPending }
}
