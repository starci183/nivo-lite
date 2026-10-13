import { useTranslations } from "next-intl"
import {
    channelRule,
    copyReadyText,
    type ChannelWarning,
    type ContentChannel,
    type ContentItem,
    type ItemTransition,
    type MediaRef,
} from "@/modules/content"
import type { ActionReply, ContentCommand } from "./useContentCommand"
import type { ContentEditorFormState, EditorSave } from "./useContentEditorForm"

/** An answer that may carry a value. */
export interface ValuedReply<V> extends ActionReply {
    readonly value?: V
}

/** What a finished draft tells the editor. */
export interface DraftDone {
    readonly warnings: ReadonlyArray<ChannelWarning>
    readonly seconds: number
}

/** A file that was stored for the post. */
export interface UploadedFile {
    readonly path: string
    readonly name: string
}

/** The Server Actions the editor commands run; the connected block hands them in. */
export interface EditorActions {
    readonly saveItem: (id: string, patch: Partial<EditorSave>) => Promise<ActionReply>
    readonly draftItem: (id: string, hint: string) => Promise<ValuedReply<DraftDone>>
    readonly submitForApproval: (id: string) => Promise<ActionReply>
    readonly transitionItem: (id: string, kind: ItemTransition) => Promise<ActionReply>
    readonly markPublished: (id: string, channel: ContentChannel, url: string, how: string) => Promise<ActionReply>
    readonly uploadMedia: (input: FormData) => Promise<ValuedReply<UploadedFile>>
}

/** What the editor needs to run its commands. */
export interface EditorCommandInput {
    readonly item: ContentItem
    readonly actions: EditorActions
    readonly state: ContentEditorFormState
    readonly command: ContentCommand
    /** Closes the editor. */
    readonly onClose: () => void
    /** Shows the findings of a fresh draft. */
    readonly onWarnings: (warnings: ReadonlyArray<ChannelWarning>) => void
}

/** The proof typed for one channel when marking it posted. */
export interface PostedProof {
    readonly url: string
    readonly how: string
}

/** The commands of the post editor. */
export interface EditorCommands {
    readonly save: () => void
    readonly draft: (hint: string) => void
    readonly submit: () => void
    readonly transition: (kind: ItemTransition) => void
    readonly upload: (file: File) => void
    readonly attach: (media: MediaRef) => void
    readonly copy: (channel: ContentChannel) => void
    readonly markPosted: (channel: ContentChannel, proof: PostedProof | undefined) => void
}

const refusedDate = (body: unknown): body is "date_invalid" | "time_invalid" => typeof body === "string"

/** The commands of the post editor: save, draft with AI, send for approval, status changes, upload, copy and mark posted. */
export const useContentEditorCommands = (input: EditorCommandInput): EditorCommands => {
    const t = useTranslations("content")
    const { item, state, command, actions } = input
    const failed = (code: string): ActionReply => ({ kind: "invalid", code })
    const saveAll = async (): Promise<ActionReply> => {
        const body = state.build(true)
        return refusedDate(body) ? failed(body) : actions.saveItem(item.id, body)
    }
    return {
        save: () => command.run("save", saveAll, () => command.say("ok", t("saved"))),
        draft: (hint) =>
            command.run(
                "draft",
                async (): Promise<ValuedReply<DraftDone>> => {
                    // Keep what was typed (title, date, theme) before the AI rewrites the channel texts.
                    const body = state.build(false)
                    if (refusedDate(body)) return failed(body)
                    const saved = await actions.saveItem(item.id, body)
                    return saved.kind === "ok" ? actions.draftItem(item.id, hint) : saved
                },
                (done) => {
                    const summary = done.value
                    if (summary === undefined) return
                    input.onWarnings(summary.warnings)
                    command.say("ok", t("draftReady", { s: summary.seconds }))
                },
            ),
        submit: () =>
            command.run(
                "submit",
                async () => {
                    const saved = await saveAll()
                    return saved.kind === "ok" ? actions.submitForApproval(item.id) : saved
                },
                () => {
                    command.say("ok", t("submitted"))
                    input.onClose()
                },
            ),
        transition: (kind) =>
            command.run(
                "transition",
                () => actions.transitionItem(item.id, kind),
                () => {
                    if (kind === "delete") input.onClose()
                },
            ),
        upload: (file) => {
            const form = new FormData()
            form.set("file", file)
            command.run("upload", async () => {
                const stored = await actions.uploadMedia(form)
                if (stored.kind !== "ok" || stored.value === undefined) return stored
                const media = [
                    ...state.form.media,
                    { kind: "media" as const, path: stored.value.path, name: stored.value.name },
                ]
                const saved = await actions.saveItem(item.id, { media })
                if (saved.kind === "ok") state.patch({ media })
                return saved
            })
        },
        attach: (media) => {
            const known = state.form.media.some((m) => (m.path && m.path === media.path) || (m.id && m.id === media.id))
            if (!known) state.patch({ media: [...state.form.media, { ...media, suggested: false }] })
        },
        copy: (channel) => {
            navigator.clipboard
                .writeText(copyReadyText(item.variants[channel]))
                .then(() => command.say("ok", `${channelRule(channel).label}: ${t("copied")}`))
                .catch(() => command.say("error", t("copyFailed")))
        },
        markPosted: (channel, proof) =>
            command.run(`posted-${channel}`, () =>
                actions.markPublished(item.id, channel, proof?.url ?? "", proof?.how ?? ""),
            ),
    }
}
