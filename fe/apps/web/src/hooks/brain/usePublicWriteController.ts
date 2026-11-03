"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { usePublicWriteForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { usePublicDocCommands } from "./usePublicDocCommands"

/** The view `usePublicWriteController` returns. */
export interface PublicWriteControllerView {
    canWrite: boolean
    isPending: boolean
    title: string
    body: string
    error: string | undefined
    close: () => void
    submit: (e?: React.BaseSyntheticEvent) => Promise<void>
    setTitle: (value: string) => void
    setBody: (value: string) => void
}

/** Owns the separate customer document form and closes it only after its draft is saved. */
export const usePublicWriteController = (initialTitle: string): PublicWriteControllerView => {
    const t = useTranslations("publicBrain")
    const router = navigation.useRouter()
    const member = useWorkspaceMember()
    const commands = usePublicDocCommands()
    const form = usePublicWriteForm(initialTitle)
    const close = () => {
        form.reset({ title: initialTitle, body: "" })
        router.replace(brainTabHref("publicDocs"))
    }
    const submit = form.handleSubmit(async (values) => {
        const saved = await commands.write(values, t("saved"))
        if (saved !== undefined) close()
    })
    return {
        canWrite: member.canWrite,
        isPending: commands.isPending || form.formState.isSubmitting,
        title: form.watch("title"),
        body: form.watch("body"),
        error: form.formState.errors.title?.message ?? form.formState.errors.body?.message,
        close,
        submit,
        setTitle: (value: string) =>
            form.setValue("title", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
        setBody: (value: string) =>
            form.setValue("body", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
    }
}
