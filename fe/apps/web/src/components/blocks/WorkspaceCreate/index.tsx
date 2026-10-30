"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useWorkspaceCreateForm } from "@/hooks/rhf"
import { useActiveWorkspace, useCreateWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, AUTH_ROUTES } from "@/modules/routes"
import { WorkspaceCreateBase } from "./component"

/** The connected create form: makes a free workspace through the back end GraphQL API (validated by react-hook-form + zod, outcome toasted), makes it the active one and lands on the Office. */
export const WorkspaceCreate = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const { create, isCreating } = useCreateWorkspace()
    const { select } = useActiveWorkspace()
    const form = useWorkspaceCreateForm()
    const [isNavigating, setNavigating] = useState(false)

    const submit = form.handleSubmit(async (values) => {
        const id = await create(values.name)
        if (id === undefined) return
        setNavigating(true)
        select(id)
        router.push(APP_ROUTES.chat)
        router.refresh()
    })

    const isPending = isCreating || isNavigating
    return (
        <WorkspaceCreateBase
            props={{
                title: t("nameTitle"),
                heading: t("nameQuestion"),
                description: t("nameQuestionText"),
                nameLabel: t("businessName"),
                nameHint: t("workspaceNameHint"),
                submitLabel: isPending ? t("creating") : t("createFirst"),
                cancelLabel: t("backToLobby"),
                cancelHref: AUTH_ROUTES.workspaces,
                failTitle: t("errGeneric"),
                name: form.watch("name"),
                isPending,
                error: form.formState.errors.name?.message,
            }}
            on={{
                setName: (value) => form.setValue("name", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
            }}
        />
    )
}
