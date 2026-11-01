"use client"

import { useTranslations } from "next-intl"
import {
    useMutateAssignDossierFindingSwr,
    useMutateConfirmDossierFindingSwr,
    useMutateDismissDossierFindingSwr,
    useMutateReopenDossierFindingSwr,
    useMutateRequestDossierReviewSwr,
    useMutateResolveDossierFindingSwr,
} from "@/hooks/swr"
import { useReviewRefresh } from "./useReviewRefresh"

/** What a block can ask of the findings of the dossier review; each command answers whether it went through, and has toasted either way. */
export interface FindingCommands {
    readonly isPending: boolean
    /** Reviews one dossier, or the whole set when none is named. */
    readonly requestReview: (dossierId: string | null) => Promise<boolean>
    /** Confirms an open finding; the note says what the owner confirmed, for example which document is right. */
    readonly confirm: (findingId: string, note?: string) => Promise<boolean>
    readonly dismiss: (findingId: string, reason: string) => Promise<boolean>
    readonly reopen: (findingId: string) => Promise<boolean>
    readonly resolve: (findingId: string, note: string) => Promise<boolean>
    readonly assign: (findingId: string, assigneeId: string | null, dueAt: string | null) => Promise<boolean>
}

/** The writes of the review that decide a finding: ask for a review, confirm, dismiss, reopen, mark done, give to someone. */
export const useFindingCommands = (): FindingCommands => {
    const t = useTranslations("dossierReview")
    const run = useReviewRefresh()
    const requestReview = useMutateRequestDossierReviewSwr()
    const confirm = useMutateConfirmDossierFindingSwr()
    const dismiss = useMutateDismissDossierFindingSwr()
    const reopen = useMutateReopenDossierFindingSwr()
    const resolve = useMutateResolveDossierFindingSwr()
    const assign = useMutateAssignDossierFindingSwr()
    return {
        isPending: [requestReview, confirm, dismiss, reopen, resolve, assign].some((one) => one.isMutating),
        requestReview: async (dossierId) =>
            (await run(() => requestReview.trigger(dossierId === null ? {} : { dossierId }), t("reviewQueued"))) !==
            undefined,
        confirm: async (findingId, note) =>
            (await run(
                () => confirm.trigger({ findingId, ...(note === undefined ? {} : { note }) }),
                t("confirmed"),
            )) !== undefined,
        dismiss: async (findingId, reason) =>
            (await run(() => dismiss.trigger({ findingId, reason: reason.trim() }), t("dismissed"))) !== undefined,
        reopen: async (findingId) => (await run(() => reopen.trigger({ findingId }), t("reopened"))) !== undefined,
        resolve: async (findingId, note) =>
            (await run(() => resolve.trigger({ findingId, note: note.trim() }), t("done"))) !== undefined,
        assign: async (findingId, assigneeId, dueAt) =>
            (await run(
                () =>
                    assign.trigger({
                        findingId,
                        ...(assigneeId === null ? {} : { assigneeId }),
                        ...(dueAt === null ? {} : { dueAt }),
                    }),
                t("assigned"),
            )) !== undefined,
    }
}
