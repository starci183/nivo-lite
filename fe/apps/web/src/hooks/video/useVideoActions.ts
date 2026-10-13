import { useTranslations } from "next-intl"
import {
    useMutateArchiveVideoProjectSwr,
    useMutateCreateVideoProjectSwr,
    useMutateDuplicateVideoProjectSwr,
    useMutateUpdateVideoProjectSwr,
} from "@/hooks/swr"
import type { MutateCreateVideoProjectRequest } from "@/modules/api/graphql/mutations/mutation-create-video-project"
import type { MutateUpdateVideoProjectRequest } from "@/modules/api/graphql/mutations/mutation-update-video-project"
import type { ProjectInputs, ScriptScene } from "@/modules/video"
import { useVideoRefresh } from "./useVideoRefresh"

/** The edits one update sends: the inputs and the scenes arrive as the editor holds them, read-only. */
interface VideoProjectPatch extends Omit<MutateUpdateVideoProjectRequest, "projectId" | "inputs" | "script"> {
    readonly inputs?: ProjectInputs
    readonly script?: ReadonlyArray<ScriptScene>
}

/** Creates, edits, duplicates and archives video projects, reports every outcome, and reads the video data again. */
export const useVideoActions = () => {
    const t = useTranslations("video")
    const { complete } = useVideoRefresh()
    const createMutation = useMutateCreateVideoProjectSwr()
    const updateMutation = useMutateUpdateVideoProjectSwr()
    const duplicateMutation = useMutateDuplicateVideoProjectSwr()
    const archiveMutation = useMutateArchiveVideoProjectSwr()
    const create = (request: MutateCreateVideoProjectRequest) =>
        complete(() => createMutation.trigger(request), t("saved"))
    const update = async (projectId: string, patch: VideoProjectPatch) => {
        const request: MutateUpdateVideoProjectRequest = {
            ...patch,
            projectId,
            inputs: patch.inputs
                ? { ...patch.inputs, sourceIds: [...patch.inputs.sourceIds], media: [...patch.inputs.media] }
                : undefined,
            script: patch.script?.map((scene) => ({ ...scene })),
        }
        return complete(() => updateMutation.trigger(request), t("saved"))
    }
    const duplicate = (projectId: string) => complete(() => duplicateMutation.trigger({ projectId }), t("saved"))
    const archive = (projectId: string) =>
        complete(() => archiveMutation.trigger({ projectId, archived: true }), t("status_archived"))
    return { create, update, duplicate, archive }
}
