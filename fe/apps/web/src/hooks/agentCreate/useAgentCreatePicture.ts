"use client"

import { useTranslations } from "next-intl"
import { useMemo, useRef, useState } from "react"
import { useAvatarEditorView, useAvatarUpload, type AvatarDoors } from "@/hooks/avatar"
import { useMutateRequestAgentAvatarUploadSwr } from "@/hooks/swr"
import type { PictureChoiceKey } from "@/modules/agentAvatar"
import type { PictureChoice } from "./agentCreate.shared"

/** The picture field of the create dialog: the chosen preset or uploaded file, and the upload. */
export interface AgentCreatePicture {
    readonly choice: PictureChoice
    readonly choosePreset: (preset: PictureChoiceKey) => void
    /** Uploads a file at once (the agent does not exist yet; its path is kept for the create call). */
    readonly upload: (files: ReadonlyArray<File>) => Promise<void>
    readonly editor: ReturnType<typeof useAvatarEditorView>
    readonly reset: () => void
}

/** The default picture of a new agent: none, so Grammar draws the sprout seeded by its name. */
const DEFAULT_CHOICE: PictureChoice = { kind: "preset", preset: "sprout" }

/**
 * Holds the picture a new agent starts with. An upload goes straight to Storage through the shared avatar upload; keeping it only
 * remembers its path (and public address for the preview), which the create call sends.
 */
export const useAgentCreatePicture = (): AgentCreatePicture => {
    const t = useTranslations("agentCreate")
    const requestUpload = useMutateRequestAgentAvatarUploadSwr()
    const [choice, setChoice] = useState<PictureChoice>(DEFAULT_CHOICE)
    const addresses = useRef(new Map<string, string>())
    const doors = useMemo<AvatarDoors>(
        () => ({
            request: async (file) => {
                const ticket = await requestUpload.trigger(file)
                addresses.current.set(ticket.path, ticket.publicUrl)
                return ticket
            },
            set: (path) => {
                setChoice(
                    path === null ? DEFAULT_CHOICE : { kind: "upload", path, url: addresses.current.get(path) ?? "" },
                )
                return Promise.resolve(true)
            },
            refresh: () => Promise.resolve(true),
            savedMessage: t("pictureUploaded"),
            removedMessage: t("pictureRemove"),
        }),
        [requestUpload, t],
    )
    const upload = useAvatarUpload(doors)
    const editor = useAvatarEditorView(upload, choice.kind === "upload")
    return {
        choice,
        choosePreset: (preset) => setChoice({ kind: "preset", preset }),
        upload: upload.choose,
        editor: { ...editor, pickLabel: t("pictureUpload"), removeLabel: t("pictureRemove") },
        reset: () => setChoice(DEFAULT_CHOICE),
    }
}
