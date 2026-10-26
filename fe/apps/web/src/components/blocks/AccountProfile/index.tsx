"use client"

import { useTranslations } from "next-intl"
import { useAccountAvatar, useAccountCommands } from "@/hooks/account"
import { useAvatarEditorView } from "@/hooks/avatar"
import { useMember } from "@/hooks/member"
import { useProfileForm } from "@/hooks/rhf"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import { AccountProfileBase } from "./component"

/**
 * The connected profile card: the picture (upload with a live preview, remove back to the default avatar) and the display name,
 * read from and saved through the back end GraphQL API (each outcome toasted).
 */
export const AccountProfile = () => {
    const t = useTranslations("account")
    const member = useMember()
    const { data, isLoading } = useQueryMyAccountSwr()
    const { saveProfile, isSaving } = useAccountCommands()
    const avatar = useAccountAvatar()
    const editor = useAvatarEditorView(
        avatar,
        data?.uploadedAvatarUrl !== null && data?.uploadedAvatarUrl !== undefined,
    )
    const form = useProfileForm(data?.name ?? "")

    const submit = form.handleSubmit(async (values) => {
        await saveProfile(values.name)
    })

    return (
        <AccountProfileBase
            props={{
                title: t("profileTitle"),
                seed: member?.userId,
                picture: avatar.preview ?? data?.avatarUrl ?? null,
                avatar: editor,
                nameLabel: t("displayName"),
                nameHint: t("displayNameHint"),
                saveLabel: t("saveProfile"),
                failTitle: t("failTitle"),
                name: form.watch("name"),
                isPending: isSaving,
                isLoading,
                error: form.formState.errors.name?.message,
            }}
            on={{
                pick: (files) => void avatar.choose(files),
                remove: () => void avatar.remove(),
                setName: (value) => form.setValue("name", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
            }}
        />
    )
}
