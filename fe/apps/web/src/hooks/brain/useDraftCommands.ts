"use client"

import { useTranslations } from "next-intl"
import {
    QUERY_BRAIN_DOSSIERS_SWR_KEY,
    QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_USAGE_SWR_KEY,
    useMutateApproveDossierRemedyDraftSwr,
    useMutateRejectDossierRemedyDraftSwr,
    useMutateRequestDossierRemedyDraftSwr,
    useMutateSaveDossierRemedyDraftSwr,
} from "@/hooks/swr"
import { useReviewRefresh } from "./useReviewRefresh"

/** The reads an approved draft changes besides the findings: the dossiers, their documents and the allowance. */
const APPROVAL_READS: ReadonlyArray<string> = [
    QUERY_BRAIN_DOSSIERS_SWR_KEY,
    QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_USAGE_SWR_KEY,
]

/** What a block can ask of the remedy drafts; each command answers whether it went through, and has toasted either way. */
export interface DraftCommands {
    readonly isPending: boolean
    /** Asks NIVO for a draft; answers the id of the draft being written. */
    readonly askDraft: (findingId: string, instructions: string) => Promise<string | undefined>
    readonly saveDraft: (draftId: string, title: string, body: string) => Promise<boolean>
    readonly approveDraft: (draftId: string) => Promise<boolean>
    readonly rejectDraft: (draftId: string, reason: string) => Promise<boolean>
}

/** An optional text the owner left empty is not sent. */
const optionalOf = (text: string): string | undefined => (text.trim() === "" ? undefined : text.trim())

/** The writes of the remedy drafts: ask NIVO to write one, save its edits, approve it into the dossier, or turn it down. */
export const useDraftCommands = (): DraftCommands => {
    const t = useTranslations("dossierReview")
    const run = useReviewRefresh()
    const askDraft = useMutateRequestDossierRemedyDraftSwr()
    const saveDraft = useMutateSaveDossierRemedyDraftSwr()
    const approveDraft = useMutateApproveDossierRemedyDraftSwr()
    const rejectDraft = useMutateRejectDossierRemedyDraftSwr()
    return {
        isPending: [askDraft, saveDraft, approveDraft, rejectDraft].some((one) => one.isMutating),
        askDraft: async (findingId, instructions) => {
            const draft = await run(
                () => askDraft.trigger({ findingId, instructions: optionalOf(instructions) }),
                t("draftGenerating"),
            )
            return draft?.id
        },
        saveDraft: async (draftId, title, body) =>
            (await run(() => saveDraft.trigger({ draftId, title: title.trim(), body }), t("saved"))) !== undefined,
        approveDraft: async (draftId) =>
            (await run(() => approveDraft.trigger({ draftId }), t("approved"), APPROVAL_READS)) !== undefined,
        rejectDraft: async (draftId, reason) =>
            (await run(() => rejectDraft.trigger({ draftId, reason: optionalOf(reason) }), t("rejected"))) !==
            undefined,
    }
}
