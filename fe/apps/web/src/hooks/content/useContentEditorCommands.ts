import { useTranslations } from "next-intl"
import {
    copyReadyText,
    type ContentChannel,
    type ContentItem,
    type ItemTransition,
    type MediaRef,
} from "@/modules/content"
import { channelLabel } from "./content.shared"
import type { ActionReply, ContentCommand } from "./useContentCommand"
import type { ContentEditorFormState } from "@/hooks/rhf"
import type { EditorSave } from "@/modules/content"

/** An answer that may carry a value. */
export interface ValuedReply<V> extends ActionReply {
    readonly value?: V
}

/** A file that was stored for the post. */
export interface UploadedFile {
    readonly path: string
    readonly name: string
}

/** The GraphQL actions the connected editor provides. */
export interface EditorActions {
    readonly saveItem: (id: string, patch: Partial<EditorSave>) => Promise<ActionReply>
    readonly draftItem: (id: string, hint: string) => Promise<ActionReply>
    readonly submitForApproval: (id: string) => Promise<ActionReply>
    readonly transitionItem: (id: string, kind: ItemTransition) => Promise<ActionReply>
    readonly markPublished: (id: string, channel: ContentChannel, url: string, how: string) => Promise<ActionReply>
    readonly uploadMedia: (file: File) => Promise<ValuedReply<UploadedFile>>
}

/** What the editor needs to run its commands. */
export interface EditorCommandInput {
    readonly item: ContentItem
    readonly actions: EditorActions
    readonly state: ContentEditorFormState
    readonly command: ContentCommand
    /** Closes the editor. */
    readonly onClose: () => void
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

/** The commands of the post editor: save, draft with AI, send for approval, status changes, upload, copy and mark posted. */
export const useContentEditorCommands = (input: EditorCommandInput): EditorCommands => {
    const t = useTranslations("content")
    const { item, state, command, actions } = input
    const saveAll = async (): Promise<ActionReply> => {
        const body = await state.build(true)
        return body === undefined ? { kind: "handled" } : actions.saveItem(item.id, body)
    }
    return {
        save: () => command.run("save", saveAll, () => command.say("ok", t("saved"))),
        draft: (hint) =>
            command.run("draft", async (): Promise<ActionReply> => {
                // Keep what was typed (title, date, theme) before the AI rewrites the channel texts.
                const body = await state.build(false)
                if (body === undefined) return { kind: "handled" }
                const saved = await actions.saveItem(item.id, body)
                return saved.kind === "ok" ? actions.draftItem(item.id, hint) : saved
            }),
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
            command.run("upload", async () => {
                const stored = await actions.uploadMedia(file)
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
                .then(() => command.say("ok", `${channelLabel(t, channel)}: ${t("copied")}`))
                .catch(() => command.say("error", t("copyFailed")))
        },
        markPosted: (channel, proof) =>
            command.run(`posted-${channel}`, () =>
                actions.markPublished(item.id, channel, proof?.url ?? "", proof?.how ?? ""),
            ),
    }
}
