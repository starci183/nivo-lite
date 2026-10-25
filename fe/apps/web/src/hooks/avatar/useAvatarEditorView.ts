"use client"

import { useTranslations } from "next-intl"
import { AVATAR_ACCEPT } from "./avatar.shared"
import type { AvatarProblem } from "./avatar.shared"

/** Where an upload stands, as the editor shows it. */
interface AvatarUploadState {
    readonly problem: AvatarProblem | null
    readonly isBusy: boolean
}

/** The worded picture editor of a profile card: the picker copy, the refusal of a chosen file and the remove action. */
export const useAvatarEditorView = (upload: AvatarUploadState, canRemove: boolean) => {
    const t = useTranslations("avatarEditor")
    return {
        label: t("label"),
        prompt: t("prompt"),
        hint: t("hint"),
        accept: AVATAR_ACCEPT,
        error: upload.problem === null ? undefined : t(`error_${upload.problem}`),
        removeLabel: t("remove"),
        canRemove,
        isBusy: upload.isBusy,
    }
}
