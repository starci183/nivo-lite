"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useWorkspaceCreateForm } from "@/hooks/rhf"
import {
    BUSINESS_TYPE_KEYS,
    OTHER_BUSINESS_TYPE,
    WORKSPACE_BUSINESS_TYPES,
    useActiveWorkspace,
    useCreateWorkspace,
} from "@/hooks/workspaces"
import type { WorkspaceBusinessType } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, AUTH_ROUTES } from "@/modules/routes"
import { WorkspaceCreateBase } from "./component"

/** The business types the form offers, for checking a picked option. */
const OFFERED: ReadonlySet<string> = new Set(WORKSPACE_BUSINESS_TYPES)

/** True when the picked option is one of the business types the form offers. */
const isBusinessType = (value: string | null): value is WorkspaceBusinessType => value !== null && OFFERED.has(value)

/** The connected create form: makes a free workspace through the back end GraphQL API (validated by react-hook-form + zod, outcome toasted), makes it the active one and moves on to the channels step. */
export const WorkspaceCreate = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const { create, isCreating } = useCreateWorkspace()
    const { select } = useActiveWorkspace()
    const form = useWorkspaceCreateForm()
    const [isNavigating, setNavigating] = useState(false)

    const submit = form.handleSubmit(async (values) => {
        const id = await create(
            values.name,
            values.businessType === OTHER_BUSINESS_TYPE ? values.customIndustry : values.businessType,
        )
        if (id === undefined) return
        setNavigating(true)
        select(id)
        router.push(APP_ROUTES.workspaceChannels)
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
                industryLabel: t("industryLabel"),
                industries: WORKSPACE_BUSINESS_TYPES.map((value) => ({
                    id: value,
                    label: t(BUSINESS_TYPE_KEYS[value]),
                })),
                industry: form.watch("businessType"),
                isOtherIndustry: form.watch("businessType") === OTHER_BUSINESS_TYPE,
                otherIndustryLabel: t("industryOtherLabel"),
                otherIndustry: form.watch("customIndustry"),
                otherIndustryError: form.formState.errors.customIndustry?.message,
                submitLabel: isPending ? t("creating") : t("continue"),
                cancelLabel: t("backToLobby"),
                cancelHref: AUTH_ROUTES.workspaces,
                failTitle: t("errGeneric"),
                name: form.watch("name"),
                isPending,
                error: form.formState.errors.name?.message,
            }}
            on={{
                setName: (value) => form.setValue("name", value, { shouldValidate: form.formState.isSubmitted }),
                setIndustry: (value) => {
                    if (isBusinessType(value)) form.setValue("businessType", value)
                },
                setOtherIndustry: (value) =>
                    form.setValue("customIndustry", value, { shouldValidate: form.formState.isSubmitted }),
                submit: () => void submit(),
            }}
        />
    )
}
