"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useAvatarUpload, type AvatarDoors } from "@/hooks/avatar"
import {
    QUERY_WORKSPACE_SETTINGS_SWR_KEY,
    useMutateRequestWorkspaceLogoUploadSwr,
    useMutateUpdateWorkspaceSettingsSwr,
} from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { mutate } from "@/modules/viewer-cache"

/**
 * The workspace logo: the same upload doors as a member's picture (a one-time address, the browser's PUT, then the path kept on the
 * workspace), or removed with a null path. The settings read, and so the top bar, reads the logo again after each change.
 */
export const useWorkspaceLogoUpload = (): ReturnType<typeof useAvatarUpload> => {
    const t = useTranslations("settings")
    const requestUpload = useMutateRequestWorkspaceLogoUploadSwr()
    const update = useMutateUpdateWorkspaceSettingsSwr()
    const doors = useMemo<AvatarDoors>(
        () => ({
            request: (file) => requestUpload.trigger(file),
            set: (path) => update.trigger({ logoPath: path }),
            refresh: () => mutate(matchesSwrKey(QUERY_WORKSPACE_SETTINGS_SWR_KEY)),
            savedMessage: t("logoSaved"),
            removedMessage: t("logoRemoved"),
        }),
        [requestUpload, update, t],
    )
    return useAvatarUpload(doors)
}
