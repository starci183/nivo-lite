"use client"

import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    DIALOG_OF_ACTION,
    DOSSIER_STATUS_TONE,
    FINDING_FILTERS,
    dossierTagOf,
    filterOfStatus,
    queryOfDossier,
    reviewedStatusOf,
    useDossierFindings,
    useDossierRecord,
    useDossierReviewCommands,
    useDossierReviewSummary,
    useFindingDialog,
    useFindingRows,
} from "@/hooks/brain"
import type {
    DossierReviewRecord,
    FindingAction,
    FindingFilter,
    FindingRowView,
    FindingView,
    ReviewedStatus,
    UploadTarget,
} from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainDossierHref } from "@/modules/routes"
import { DossierFindingsBase } from "./component"

/** Props for the connected findings pane of one dossier: what the address asks of it. */
interface DossierFindingsProps {
    readonly dossierId: string
    /** The finding the address points at; its list opens and its row is marked. */
    readonly findingId: string | undefined
}

const PLACEHOLDER_ROW: FindingRowView = {
    id: "placeholder",
    title: "-",
    titleHref: null,
    detail: "-",
    badges: [{ id: "severity", label: "-", tone: "neutral" }],
    meta: null,
    isFocused: false,
    evidenceTitle: "-",
    evidence: [],
    sources: [],
    actions: [],
}

/** Rows of the same shape as a ready list, drawn as geometry while the findings are read. */
const PLACEHOLDER: ReadonlyArray<FindingRowView> = [1, 2, 3].map((n) => ({
    ...PLACEHOLDER_ROW,
    id: `placeholder-${n}`,
}))

/** The words of the segment of each list. */
const FILTER_KEY = { open: "filterOpen", confirmed: "filterConfirmed", closed: "filterClosed" } as const

const filterOf = (value: string, fallback: FindingFilter): FindingFilter =>
    FINDING_FILTERS.find((one) => one === value) ?? fallback

type ReviewTranslate = ReturnType<typeof useTranslations<"dossierReview">>
type BrainTranslate = ReturnType<typeof useTranslations<"secondBrain">>
type Formatter = ReturnType<typeof useFormatter>

/** The badges under the heading: the status the review stands at, then the checklist's own when it differs. */
const badgesOf = (t: ReviewTranslate, brain: BrainTranslate, standing: ReviewedStatus) => [
    {
        id: "status",
        label: brain(`status_${standing.status}`),
        tone: DOSSIER_STATUS_TONE[standing.status],
    },
    ...(standing.checklist === null
        ? []
        : [
              {
                  id: "checklist",
                  label: t("checklistStatus", { status: brain(`status_${standing.checklist}`) }),
                  tone: "muted" as const,
              },
          ]),
]

/** When the review last looked at the dossier, or that it never did. */
const reviewedLineOf = (t: ReviewTranslate, format: Formatter, review: DossierReviewRecord | undefined): string =>
    review === undefined
        ? t("neverReviewed")
        : t("reviewedAt", {
              time: format.dateTime(new Date(review.reviewedAt), { dateStyle: "medium", timeStyle: "short" }),
          })

/** Why the last run read nothing with AI, in words. */
const aiNoticeOf = (t: ReviewTranslate, notice: "credits" | "budget"): string =>
    t(notice === "credits" ? "aiSkippedCredits" : "aiSkippedBudget")

/** The connected findings of one dossier: the pane beside the list of dossiers, or its drawer on a narrow screen. */
export const DossierFindings = (props: DossierFindingsProps) => {
    const t = useTranslations("dossierReview")
    const brain = useTranslations("secondBrain")
    const format = useFormatter()
    const router = navigation.useRouter()
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const { dossier } = useDossierRecord(props.dossierId)
    const summary = useDossierReviewSummary()
    const list = useDossierFindings(queryOfDossier(props.dossierId), true, summary.revision)
    const commands = useDossierReviewCommands()
    const { rowOf } = useFindingRows()
    const [picked, setPicked] = useState<FindingFilter | undefined>(undefined)
    const openDraft = (finding: FindingView, draftId: string) =>
        router.replace(brainDossierHref(props.dossierId, { finding: finding.id, draft: draftId }))
    const dialog = useFindingDialog(commands, list.members, openDraft)
    const findings = list.slot.items ?? []
    const focused = findings.find((one) => one.id === props.findingId)
    const filter = picked ?? (focused === undefined ? "open" : filterOfStatus(focused.status))
    const review = summary.reviewOf(props.dossierId)
    const standing = reviewedStatusOf(dossier?.status ?? "", review)
    const upload: UploadTarget | null =
        dossier === undefined ? null : { category: dossier.category, tag: dossierTagOf(dossier.ref) }
    const labels = slotLabels(t("emptyDossier"))
    const act = (findingId: string, action: FindingAction) => {
        const finding = findings.find((one) => one.id === findingId)
        if (finding === undefined) return
        const kind = DIALOG_OF_ACTION[action]
        if (kind !== undefined) dialog.open(kind, finding)
        else if (action === "confirm") void commands.confirm(finding.id)
        else if (action === "reopen") void commands.reopen(finding.id)
        else if (action === "viewDraft" && finding.draftId !== null) openDraft(finding, finding.draftId)
    }
    return (
        <DossierFindingsBase
            props={{
                title: dossier?.name ?? "-",
                badges: dossier === undefined ? [] : badgesOf(t, brain, standing),
                reviewedLine: reviewedLineOf(t, format, review),
                isRunning: summary.isRunning,
                runningLabel: t("reviewRunning"),
                reviewLabel: member.canWrite ? t("reviewOne") : null,
                aiNotice: summary.aiNotice === null ? null : aiNoticeOf(t, summary.aiNotice),
                filterLabel: t("filterLabel"),
                filters: FINDING_FILTERS.map((one) => ({ value: one, label: t(FILTER_KEY[one]) })),
                filter,
                listLabel: t("findingsLabel"),
                slot: mapSlot(list.slot, (all) =>
                    all
                        .filter((one) => filterOfStatus(one.status) === filter)
                        .map((one) =>
                            rowOf(one, {
                                members: list.members,
                                canWrite: member.canWrite,
                                focusedId: props.findingId,
                                showDossier: false,
                                upload,
                            }),
                        ),
                ),
                placeholder: PLACEHOLDER,
                slotLabels: labels,
                hasNextPage: list.hasNextPage,
                isLoadingMore: list.isLoadingMore,
                loadMoreLabel: t("loadMore"),
                pageFailure: list.hasPageFailure ? labels.error : null,
                dialog: dialog.view,
            }}
            on={{
                setFilter: (value) => setPicked(filterOf(value, filter)),
                review: () => void commands.requestReview(props.dossierId),
                action: act,
                loadMore: list.loadMore,
                retry: list.retry,
                submitDialog: (values) => void dialog.submit(values),
                closeDialog: dialog.close,
            }}
        />
    )
}
