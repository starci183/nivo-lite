"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { WORKSPACE_NAME_MAX, WORKSPACE_NAME_MIN, useCreateWorkspace, workspaceErrorKey } from "@/hooks/workspaces"
import { writeSwitchWorkspace } from "@/modules/db/shell/write-switch-workspace"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, AUTH_ROUTES } from "@/modules/routes"
import { WorkspaceCreateBase } from "./component"

/** The connected create form: makes a free workspace through the back end api, makes it the current one and lands on the Office. */
export const WorkspaceCreate = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const create = useCreateWorkspace()
    const [name, setName] = useState("")
    const [error, setError] = useState<string>()
    const [isPending, startTransition] = useTransition()

    const submit = () => {
        setError(undefined)
        const length = name.trim().length
        if (length < WORKSPACE_NAME_MIN || length > WORKSPACE_NAME_MAX) return setError(t("errName"))
        startTransition(async () => {
            const created = await create(name)
            if (created.kind !== "ok") return setError(t(workspaceErrorKey(created.code)))
            await writeSwitchWorkspace(created.value.id)
            router.push(APP_ROUTES.chat)
            router.refresh()
        })
    }

    return (
        <WorkspaceCreateBase
            props={{
                title: t("nameTitle"),
                nameLabel: t("workspaceName"),
                nameHint: t("workspaceNameHint"),
                submitLabel: isPending ? t("creating") : t("createFirst"),
                cancelLabel: t("cancel"),
                cancelHref: AUTH_ROUTES.workspaces,
                failTitle: t("errGeneric"),
                name,
                isPending,
                error,
            }}
            on={{ setName, submit }}
        />
    )
}
