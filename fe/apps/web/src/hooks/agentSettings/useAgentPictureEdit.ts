"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { useAvatarEditorView, useAvatarUpload, type AvatarDoors } from "@/hooks/avatar"
import {
    useMutateRequestAgentAvatarUploadSwr,
    useMutateSetAgentAvatarPresetSwr,
    useMutateSetAgentAvatarSwr,
} from "@/hooks/swr"
import { PICTURE_CHOICES, choiceSrcOf, isPictureChoice, storedPresetOf } from "@/modules/agentAvatar"
import { useGraphQLWithToast } from "@/modules/toast"
import { useRefreshInstallation } from "./useRefreshInstallation"

/** One choice of the picture picker: its key, its image (null lets Grammar draw the sprout or the initials). */
export interface PictureOptionData {
    readonly value: string
    readonly src: string | null
    readonly isInitials: boolean
}

/** The view `useAgentPictureEdit` returns. */
export interface AgentPictureEditView {
    /** The chosen file while it uploads; null otherwise. */
    readonly preview: string | null
    readonly editor: ReturnType<typeof useAvatarEditorView>
    readonly upload: (files: ReadonlyArray<File>) => Promise<void>
    readonly remove: () => Promise<void>
    /** Dresses the agent in a preset, dropping any uploaded picture; a text that is no preset does nothing. */
    readonly choosePreset: (preset: string) => Promise<void>
    /** The presets with the image each draws for an agent of the role (null draws the initials). */
    readonly presets: ReadonlyArray<PictureOptionData>
    readonly isBusy: boolean
}

/**
 * The picture of an agent edited later, on Setup > General: upload one (it goes straight to Storage), remove it, or pick a preset
 * (none for the default sprout, the NIVO AI mark, the role mark, the initials, a shop mark). Each change is toasted, then the installations are read again.
 */
export const useAgentPictureEdit = (
    agentId: string | null,
    moduleKey: string,
    hasUpload: boolean,
): AgentPictureEditView => {
    const t = useTranslations("agentCreate")
    const runGraphQL = useGraphQLWithToast()
    const refresh = useRefreshInstallation()
    const requestUpload = useMutateRequestAgentAvatarUploadSwr()
    const setAvatar = useMutateSetAgentAvatarSwr()
    const setPreset = useMutateSetAgentAvatarPresetSwr()
    const doors = useMemo<AvatarDoors>(
        () => ({
            request: (file) => requestUpload.trigger(file),
            set: (path) => setAvatar.trigger({ agentId: agentId ?? "", path }),
            refresh,
            savedMessage: t("pictureSaved"),
            removedMessage: t("pictureRemoved"),
        }),
        [agentId, requestUpload, setAvatar, refresh, t],
    )
    const upload = useAvatarUpload(doors)
    const editor = useAvatarEditorView(upload, hasUpload)
    const choosePreset = useCallback(
        async (preset: string): Promise<void> => {
            if (agentId === null || !isPictureChoice(preset)) return
            const done = await runGraphQL(
                () => setPreset.trigger({ agentId, preset: storedPresetOf(preset) }),
                { successMessage: t("pictureSaved") },
            )
            if (done !== undefined) await refresh()
        },
        [agentId, runGraphQL, setPreset, refresh, t],
    )
    return {
        preview: upload.preview,
        editor,
        upload: upload.choose,
        remove: upload.remove,
        choosePreset,
        presets: PICTURE_CHOICES.map((key) => ({
            value: key,
            src: choiceSrcOf(key, moduleKey),
            isInitials: key === "initials",
        })),
        isBusy: upload.isBusy || setPreset.isMutating,
    }
}
