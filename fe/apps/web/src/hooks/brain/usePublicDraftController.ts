"use client"

import { useTranslations } from "next-intl"
import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { usePublicDraftForm } from "@/hooks/rhf"
import { mapSlot } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { usePublicDocCommands } from "./usePublicDocCommands"

/** Owns source selection and validation; a failed source read stays retryable instead of becoming an empty list. */
export const usePublicDraftController = () => {
    const t = useTranslations("publicBrain")
    const router = navigation.useRouter()
    const member = useWorkspaceMember()
    const read = useKnowledgeSources()
    const commands = usePublicDocCommands()
    const { form, maxSources } = usePublicDraftForm()
    const close = () => {
        form.reset()
        router.replace(brainTabHref("publicDocs"))
    }
    const submit = form.handleSubmit(async (values) => {
        const eligible = new Set(
            (read.sources ?? [])
                .filter((source) => source.visibility === "internal" && source.status === "ready")
                .map((source) => source.id),
        )
        if (read.error !== undefined || values.sourceIds.some((id) => !eligible.has(id))) {
            form.setError("sourceIds", { message: t("pickSourcesChanged") })
            return
        }
        const saved = await commands.draft(
            {
                title: values.title,
                sourceIds: values.sourceIds,
                ...(values.instructions === "" ? {} : { instructions: values.instructions }),
            },
            t("drafting"),
        )
        if (saved !== undefined) close()
    })
    return {
        canWrite: member.canWrite,
        isPending: commands.isPending || form.formState.isSubmitting,
        sources: mapSlot(read.slot, (all) =>
            all
                .filter((source) => source.visibility === "internal" && source.status === "ready")
                .map((source) => ({ id: source.id, label: source.title })),
        ),
        reload: read.reload,
        maxSources,
        title: form.watch("title"),
        selected: form.watch("sourceIds"),
        instructions: form.watch("instructions"),
        error:
            form.formState.errors.title?.message ??
            form.formState.errors.sourceIds?.message ??
            form.formState.errors.instructions?.message,
        close,
        submit,
        setTitle: (value: string) =>
            form.setValue("title", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
        setSelected: (ids: readonly string[]) =>
            form.setValue("sourceIds", [...ids], { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
        setInstructions: (value: string) =>
            form.setValue("instructions", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
    }
}
