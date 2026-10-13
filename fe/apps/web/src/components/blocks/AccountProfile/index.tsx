"use client"

import { useTranslations } from "next-intl"
import { useAccount, useAccountCommands } from "@/hooks/account"
import { useProfileForm } from "@/hooks/rhf"
import { AccountProfileBase } from "./component"

/** The connected display-name card: reads the account from the back end GraphQL API and saves the name through it (outcome toasted). */
export const AccountProfile = () => {
    const t = useTranslations("account")
    const { data, isLoading } = useAccount()
    const { saveProfile, isSaving } = useAccountCommands()
    const form = useProfileForm(data?.name ?? "")

    const submit = form.handleSubmit(async (values) => {
        await saveProfile(values.name)
    })

    return (
        <AccountProfileBase
            props={{
                title: t("profileTitle"),
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
                setName: (value) => form.setValue("name", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
            }}
        />
    )
}
