"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { editorSchema, emptyVariant, initialForm, toEditorSave } from "@/modules/content"
import type { ContentChannel, ContentItem, EditorForm, EditorSave, Variant } from "@/modules/content"

/** The validated state and edits of one post. */
export interface ContentEditorFormState {
    readonly form: EditorForm
    readonly error: string | undefined
    readonly patch: (change: Partial<EditorForm>) => void
    readonly setVariant: (channel: ContentChannel, change: Partial<Variant>) => void
    readonly setTags: (channel: ContentChannel, text: string) => void
    readonly dismissError: () => void
    readonly validateProof: (channel: ContentChannel) => Promise<boolean>
    /** Validates the form before producing the mutation input. */
    readonly build: (withVariants: boolean) => Promise<EditorSave | undefined>
}

const VALIDATED_FIELDS = [
    "title",
    "brief",
    "pillarId",
    "channels",
    "date",
    "time",
    "hint",
    "variants",
    "tags",
    "media",
    "links",
] as const

/** The message of the first field in error, or the generic input message when it carries none. */
const messageOf = (first: { readonly message?: unknown } | undefined, fallback: string): string | undefined => {
    if (first === undefined) return undefined
    return typeof first.message === "string" ? first.message : fallback
}

/** Manages and validates the editor, including fields returned by a completed AI draft. */
export const useContentEditorForm = (item: ContentItem): ContentEditorFormState => {
    const t = useTranslations("content")
    const schema = useMemo(() => editorSchema(t), [t])
    const controller = useForm<EditorForm>({ resolver: zodResolver(schema), defaultValues: initialForm(item) })
    const { reset } = controller
    const { dirtyFields } = controller.formState
    const loaded = useRef({ id: item.id, updatedAt: item.updated_at, draftedAt: item.drafted_at })
    useEffect(() => {
        if (loaded.current.id === item.id && loaded.current.updatedAt === item.updated_at) return
        const keepDirtyValues =
            loaded.current.id === item.id &&
            loaded.current.draftedAt === item.drafted_at &&
            Object.keys(dirtyFields).length > 0
        loaded.current = { id: item.id, updatedAt: item.updated_at, draftedAt: item.drafted_at }
        reset(initialForm(item), { keepDirtyValues })
    }, [dirtyFields, item, reset])
    const form = useWatch({ control: controller.control, compute: (values: EditorForm) => values })
    const patch = (change: Partial<EditorForm>): void => {
        controller.reset({ ...controller.getValues(), ...change }, { keepErrors: true, keepDefaultValues: true })
    }
    const setVariant = (channel: ContentChannel, change: Partial<Variant>): void => {
        const current = controller.getValues("variants")
        const variant = { ...(current[channel] ?? emptyVariant()), ...change }
        controller.setValue(
            "variants",
            { ...current, [channel]: { ...variant, hashtags: [...variant.hashtags] } },
            { shouldDirty: true },
        )
    }
    const setTags = (channel: ContentChannel, text: string): void => {
        controller.setValue("tags", { ...controller.getValues("tags"), [channel]: text }, { shouldDirty: true })
    }
    const build = async (withVariants: boolean): Promise<EditorSave | undefined> => {
        if (!(await controller.trigger([...VALIDATED_FIELDS]))) return undefined
        return toEditorSave(controller.getValues(), withVariants)
    }
    const errors = controller.formState.errors
    const first =
        errors.title ??
        errors.channels ??
        errors.date ??
        errors.time ??
        errors.brief ??
        errors.links ??
        errors.media ??
        errors.variants ??
        errors.hint ??
        errors.proof
    return {
        form,
        patch,
        setVariant,
        setTags,
        build,
        error: messageOf(first, t("err_input")),
        dismissError: () => controller.clearErrors(),
        validateProof: (channel) => controller.trigger(`proof.${channel}`),
    }
}
