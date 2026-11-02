"use client"
import type { ContentViews, ContentActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    CHANNEL_RULES,
    channelLabel,
    CONTENT_CHANNELS,
    toInstant,
    useContentCommand,
    useContentFocus,
    useContentItemActions,
} from "@/hooks/content"
import { useContentAddPostForm } from "@/hooks/rhf"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentViewInput } from "./contentWorkbench.shared"

/** Owns the actual ContentAddPost data derivations and conditional controller lifetime. */
export const useContentAddPostView = (input: ContentViewInput) => {
    const data = input.data
    const pillars = data?.pillars.filter((pillar) => pillar.active) ?? []
    const t = useTranslations("content")
    const command = useContentCommand(input.isActive && input.isReady, input.scope)
    const focus = useContentFocus()
    const actions = useContentItemActions()
    const form = useContentAddPostForm()
    const [isOpen, setOpen] = useState(false)
    const { title, date, time, pillarId, channels } = form.watch()
    const run = contentPostSubmission({ form, t, command, focus, actions, setOpen })

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            form.reset()
            setOpen(false)
        },
    })

    const props: ContentViews["addPostFields"] | undefined =
        data === undefined
            ? undefined
            : {
                  copy: input.copy,
                  isOpen,
                  title,
                  date,
                  time,
                  pillarId,
                  channels,
                  channelOptions: CHANNEL_RULES.map((rule) => ({ value: rule.key, label: channelLabel(t, rule.key) })),
                  pillarOptions: [
                      { id: "", label: t("noPillar") },
                      ...pillars.map((p) => ({ id: p.id, label: p.name })),
                  ],
                  isPending: command.isPending,
                  note: command.note,
              }
    const on: ContentActions["addPostActions"] = {
        open: () => {
            if (input.isActive && input.isReady) setOpen(true)
        },
        close: () => setOpen(false),
        openChange: (open) => {
            if (!open && !command.isPending) setOpen(false)
        },
        title: (value) => form.setValue("title", value),
        date: (value) => form.setValue("date", value),
        time: (value) => form.setValue("time", value),
        pillar: (value) => form.setValue("pillarId", value || null),
        channels: (values) =>
            form.setValue(
                "channels",
                CONTENT_CHANNELS.filter((c) => values.includes(c)),
            ),
        run: () => {
            run()
        },
        dismissNote: command.dismiss,
    }
    return { props, on }
}

interface ContentPostSubmissionInput {
    readonly form: ReturnType<typeof useContentAddPostForm>
    readonly t: ReturnType<typeof useTranslations<"content">>
    readonly command: ReturnType<typeof useContentCommand>
    readonly focus: ReturnType<typeof useContentFocus>
    readonly actions: ReturnType<typeof useContentItemActions>
    readonly setOpen: (isOpen: boolean) => void
}

/** Keeps manual-post validation and successful focus navigation together as one submission. */
const contentPostSubmission = (input: ContentPostSubmissionInput) => {
    const { form, t, command, focus, actions, setOpen } = input
    return form.handleSubmit(
        (values) => {
            const at = toInstant(values.date, values.time, "19:30")
            if (at === "date_invalid" || at === "time_invalid") {
                command.say("error", t(at === "date_invalid" ? "dateInvalid" : "timeInvalid"))
                return
            }
            command.run(
                "add",
                () =>
                    actions.create({
                        title: values.title,
                        scheduledAt: at,
                        channels: values.channels,
                        pillarId: values.pillarId,
                    }),
                (done) => {
                    if (done.kind !== "ok") return
                    setOpen(false)
                    form.reset()
                    if ("value" in done) focus.open(done.value.id)
                },
            )
        },
        (errors) => {
            const message = Object.values(errors).find((error) => error?.message)?.message
            if (message) command.say("error", message)
        },
    )
}
