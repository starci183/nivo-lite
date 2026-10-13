"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { NAME_MIN } from "@/hooks/account"
import { writeProfile } from "@/modules/db/account/write-profile"
import { navigation } from "@/modules/i18n"
import { AccountProfileBase } from "./component"

const { useRouter } = navigation

/** Props for the connected profile card. */
interface AccountProfileProps {
    /** The display name now saved. */
    readonly name: string
    /** True while the page loads: the card keeps its labels and shows skeletons. */
    readonly isLoading?: boolean
}

/** The connected display-name card: saves the name through a Server Action, then refreshes the page data. */
export const AccountProfile = (props: AccountProfileProps) => {
    const t = useTranslations("account")
    const router = useRouter()
    const [name, setName] = useState(props.name)
    const [error, setError] = useState<string>()
    const [done, setDone] = useState<string>()
    const [isPending, startTransition] = useTransition()

    const submit = () => {
        setError(undefined)
        setDone(undefined)
        if (name.trim().length < NAME_MIN) return setError(t("errName"))
        startTransition(async () => {
            const saved = await writeProfile(name)
            if (saved.kind !== "ok") return setError(t("unknownError"))
            setDone(t("profileSaved"))
            router.refresh()
        })
    }

    return (
        <AccountProfileBase
            props={{
                title: t("profileTitle"),
                nameLabel: t("displayName"),
                nameHint: t("displayNameHint"),
                saveLabel: t("saveProfile"),
                failTitle: t("failTitle"),
                name,
                isPending,
                isLoading: props.isLoading ?? false,
                error,
                done,
            }}
            on={{ setName, submit }}
        />
    )
}
