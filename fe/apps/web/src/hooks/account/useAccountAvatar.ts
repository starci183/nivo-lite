"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { mutate } from "@/modules/viewer-cache"
import { useAvatarUpload } from "@/hooks/avatar"
import type { AvatarDoors } from "@/hooks/avatar"
import {
    QUERY_MY_ACCOUNT_SWR_KEY,
    QUERY_OFFICE_ROOMS_SWR_KEY,
    useMutateRequestMyAvatarUploadSwr,
    useMutateSetMyAvatarSwr,
} from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"

/**
 * The signed-in person's own picture: upload it straight to Storage and keep it, or remove it (back to the sign-in provider's
 * photo or the generated avatar). The account and the Office rooms read it again after each change.
 */
export const useAccountAvatar = () => {
    const t = useTranslations("account")
    const requestUpload = useMutateRequestMyAvatarUploadSwr()
    const setAvatar = useMutateSetMyAvatarSwr()
    const doors = useMemo<AvatarDoors>(
        () => ({
            request: (file) => requestUpload.trigger(file),
            set: (path) => setAvatar.trigger({ path }),
            refresh: () =>
                Promise.all([
                    mutate(matchesSwrKey(QUERY_MY_ACCOUNT_SWR_KEY)),
                    mutate(matchesSwrKey(QUERY_OFFICE_ROOMS_SWR_KEY)),
                ]),
            savedMessage: t("avatarSaved"),
            removedMessage: t("avatarRemoved"),
        }),
        [requestUpload, setAvatar, t],
    )
    return useAvatarUpload(doors)
}
