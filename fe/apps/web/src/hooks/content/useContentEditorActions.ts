"use client"

import {
    useMutateMarkContentPublishedSwr,
    useMutateRequestContentMediaUploadSwr,
    useMutateSaveContentItemSwr,
    useMutateSubmitContentForApprovalSwr,
    useMutateTransitionContentItemSwr,
    usePutPresignedSwr,
} from "@/hooks/swr"
import type { MutateSaveContentItemRequest } from "@/hooks/swr"
import type { EditorSave } from "@/modules/content"
import { useGraphQLWithToast, useRestWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import type { ActionReply } from "./useContentCommand"
import type { EditorActions } from "./useContentEditorCommands"

const saveRequest = (id: string, patch: Partial<EditorSave>): MutateSaveContentItemRequest => ({
    id,
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.brief === undefined ? {} : { brief: patch.brief }),
    ...(patch.pillarId === undefined ? {} : { pillarId: patch.pillarId }),
    ...(patch.scheduledAt === undefined ? {} : { scheduledAt: patch.scheduledAt }),
    ...(patch.channels === undefined ? {} : { channels: [...patch.channels] }),
    ...(patch.links === undefined ? {} : { links: patch.links.map((link) => ({ ...link })) }),
    ...(patch.media === undefined ? {} : { media: patch.media.map((media) => ({ ...media })) }),
    ...(patch.variants === undefined
        ? {}
        : {
              variants: Object.entries(patch.variants).flatMap(([channel, variant]) =>
                  variant === undefined ? [] : [{ channel, ...variant, hashtags: [...variant.hashtags] }],
              ),
          }),
})

const reply = (result: unknown): ActionReply => ({ kind: result === undefined ? "handled" : "ok" })

/** Runs the editor's GraphQL mutations with localized toast feedback, and uploads files to the issued storage URL. */
export const useContentEditorActions = (draftItem: EditorActions["draftItem"]): EditorActions => {
    const t = useTranslations("content")
    const runGraphQL = useGraphQLWithToast()
    const runRest = useRestWithToast()
    const { trigger: putPresigned } = usePutPresignedSwr()
    const save = useMutateSaveContentItemSwr()
    const transition = useMutateTransitionContentItemSwr()
    const submit = useMutateSubmitContentForApprovalSwr()
    const mark = useMutateMarkContentPublishedSwr()
    const upload = useMutateRequestContentMediaUploadSwr()
    return {
        saveItem: async (id, patch) =>
            reply(await runGraphQL(() => save.trigger(saveRequest(id, patch)), { successMessage: t("saved") })),
        draftItem,
        transitionItem: async (id, kind) =>
            reply(await runGraphQL(() => transition.trigger({ id, kind }), { successMessage: t("saved") })),
        submitForApproval: async (id) =>
            reply(await runGraphQL(() => submit.trigger({ id }), { successMessage: t("submitted") })),
        markPublished: async (id, channel, url, how) =>
            reply(await runGraphQL(() => mark.trigger({ id, channel, url, how }), { successMessage: t("saved") })),
        uploadMedia: async (file) => {
            const prepared = await runGraphQL(
                () => upload.trigger({ name: file.name, contentType: file.type, sizeBytes: file.size }),
                { showSuccessToast: false },
            )
            if (prepared === undefined) return { kind: "handled" }
            const stored = await runRest(
                async () => {
                    await putPresigned({ url: prepared.signedUrl, file })
                    return { path: prepared.path, name: prepared.name }
                },
                { successMessage: t("saved") },
            )
            return stored === null ? { kind: "handled" } : { kind: "ok", value: stored }
        },
    }
}
