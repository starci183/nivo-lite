"use client"

import { useSaveContentBrand } from "@/hooks/content"
import { useContentBrandForm } from "@/hooks/rhf"
import { defaultSettings } from "@/modules/content"
import { useMemo } from "react"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentNoteView } from "@/modules/types"
import type { ContentViewInput } from "./contentWorkbench.shared"

/** Owns the brand form and its mutation state only for the active settings lifetime. */
export const useContentBrandCardView = (input: ContentViewInput) => {
    const defaults = useMemo(() => defaultSettings(input.workspaceId ?? ""), [input.workspaceId])
    const form = useContentBrandForm(input.data?.settings ?? defaults)
    const mutation = useSaveContentBrand({ isActive: input.isActive && input.isReady, scope: input.scope })
    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset()
        },
    })
    const values = form.watch()
    const error = Object.values(form.formState.errors).find((field) => field?.message)?.message
    const note: ContentNoteView | null = error ? { tone: "error", text: error } : null
    return {
        props:
            input.data === undefined
                ? undefined
                : {
                      copy: input.copy,
                      voice: values.brandVoice,
                      avoid: values.avoid,
                      cta: values.cta,
                      tags: values.hashtags,
                      canManage: input.data.canManage,
                      isPending: mutation.isPending || form.formState.isSubmitting,
                      note,
                  },
        on: {
            voice: (value: string) => form.setValue("brandVoice", value),
            avoid: (value: string) => form.setValue("avoid", value),
            cta: (value: string) => form.setValue("cta", value),
            tags: (value: string) => form.setValue("hashtags", value),
            save: () => {
                if (!input.isActive || !input.isReady || input.data?.canManage !== true) return
                return form.handleSubmit((request) => mutation.save(request))()
            },
            dismissNote: () => form.clearErrors(),
        },
    }
}
