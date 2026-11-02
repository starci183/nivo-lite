"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useFeatureReset } from "@/hooks/reuseables"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** What the text form of the inbox needs. */
export interface ChatbotTextFormOptions {
    readonly draft: string
    /** The catalog key of the words shown when the text is over the limit. */
    readonly tooLong: "replyTooLong" | "answerTooLong"
    readonly onDraft: (draft: string) => void
    readonly onSubmit: (text: string) => void
    readonly isActive?: boolean
    readonly scope?: string
}

/** Validates a reply or an escalation answer with the same text limits as the GraphQL input. Drafts stay with their conversation. */
export const useChatbotTextForm = ({
    draft,
    tooLong,
    onDraft,
    onSubmit,
    isActive = true,
    scope,
}: ChatbotTextFormOptions) => {
    const t = useTranslations("workbenchChatbot")
    const schema = z.object({ text: z.string().trim().min(1, t("emptyReply")).max(4000, t(tooLong)) })
    const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: { text: draft } })
    const reset = form.reset
    useFeatureReset({ isActive, isReady: true, scope: scope ?? "", onReset: reset })
    return {
        error: form.formState.errors.text?.message ?? null,
        setDraft: (text: string) => {
            form.setValue("text", text, { shouldValidate: form.formState.isSubmitted })
            onDraft(text)
        },
        submit: form.handleSubmit(({ text }) => onSubmit(text)),
    }
}
