import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    DIALOG_OF_ACTION,
    FINDING_FILTERS,
    dossierTagOf,
    findingCountsOf,
    filterOfStatus,
    queryOfDossier,
    reviewedStatusOf,
    type FindingAction,
    type FindingDialogValues,
    type FindingFilter,
    type DossierFindingsPane,
    type FindingView,
} from "@/modules/brain"
import { brainDossierHref } from "@/modules/routes"
import { toast } from "@/modules/toast"
import {
    DOSSIER_AI_NOTICE_KEY,
    DOSSIER_FILTER_KEY,
    dossierBadgesOf,
    dossierFilterOf,
    dossierIdOf,
    type FindingsSelection,
    dossierReviewedLineOf,
} from "./brain.shared"
import { useBrainDossiers } from "./useBrainDossiers"
import { useDossierFindings } from "./useDossierFindings"
import { useDossierRecord } from "./useDossierRecord"
import { useDossierReviewCommands } from "./useDossierReviewCommands"
import { useDossierReviewSummary } from "./useDossierReviewSummary"
import { useFindingDialog } from "./useFindingDialog"
import { useFindingRows, type UploadTarget } from "./useFindingRows"
import { useWorkspaceRouter } from "@/hooks/workspaces"

/** The real read and its resolved inputs, before the pane's atom projection. */
interface PaneContext {
    readonly dossierId: string | undefined
    readonly findingId: string | undefined
    readonly dossier: ReturnType<typeof useDossierRecord>["dossier"]
    readonly summary: ReturnType<typeof useDossierReviewSummary>
    readonly list: ReturnType<typeof useDossierFindings>
    readonly dialog: ReturnType<typeof useFindingDialog>["view"]
    readonly rowOf: ReturnType<typeof useFindingRows>["rowOf"]
    readonly t: ReturnType<typeof useTranslations<"dossierReview">>
    readonly brain: ReturnType<typeof useTranslations<"secondBrain">>
    readonly format: ReturnType<typeof useFormatter>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly canWrite: boolean
    readonly isReviewPending: boolean
    readonly filter: FindingFilter
    readonly counts: ReturnType<typeof findingCountsOf>
}

/** Words the actual findings read without changing its independent status, failure or paging state. */
const paneOf = (context: PaneContext): DossierFindingsPane => {
    const { dossierId, findingId, dossier, summary, list, rowOf, t, brain, format, canWrite, filter, counts } = context
    const review = dossierId === undefined ? undefined : summary.reviewOf(dossierId)
    const standing = reviewedStatusOf(dossier?.status ?? "", review)
    const upload: UploadTarget | null =
        dossier === undefined ? null : { category: dossier.category, tag: dossierTagOf(dossier.ref) }
    const labels = context.slotLabels(t("emptyDossier"))
    return {
        isVisible: dossierId !== undefined,
        frame: {
            title: dossier?.name ?? "-",
            badges: dossier === undefined ? [] : dossierBadgesOf(t, brain, standing),
            reviewedLine: dossierReviewedLineOf(t, format, review),
            isRunning: summary.isRunning,
            runningLabel: t("reviewRunning"),
            reviewLabel: canWrite ? t("reviewOne") : null,
            isReviewPending: context.isReviewPending || summary.isRunning,
            aiNotice: summary.aiNotice === null ? null : t(DOSSIER_AI_NOTICE_KEY[summary.aiNotice]),
            hasNextPage: list.hasNextPage,
            isLoadingMore: list.isLoadingMore,
            loadMoreLabel: t("loadMore"),
            pageFailure: list.hasPageFailure ? labels.error : null,
            retryLabel: labels.retry,
            dialog: context.dialog,
        },
        filterLabel: t("filterLabel"),
        filters: FINDING_FILTERS.map((one) => ({ value: one, label: t(DOSSIER_FILTER_KEY[one]), count: counts[one] })),
        filter,
        listLabel: t("findingsLabel"),
        slot: mapSlot(list.slot, (all) =>
            all
                .filter((one) => filterOfStatus(one.status) === filter)
                .map((one) =>
                    rowOf(one, {
                        members: list.members,
                        canWrite,
                        focusedId: findingId,
                        showDossier: false,
                        upload,
                    }),
                ),
        ),
        slotLabels: labels,
    }
}

/** The view `useDossierFindingsView` returns. */
export interface DossierFindingsView {
    props: DossierFindingsPane
    on: {
        setFilter: (value: string) => void
        review: () => void
        action: (id: string, action: FindingAction) => void
        loadMore: () => void
        retry: () => void
        submitDialog: (values: Parameters<(values: FindingDialogValues) => Promise<void>>[0]) => void
        closeDialog: () => void
    }
}

/** Owns the findings read, its filter/dialog session and commands; an unselected map node reads no findings. */
export const useDossierFindingsView = (input: FindingsSelection): DossierFindingsView => {
    const t = useTranslations("dossierReview")
    const brain = useTranslations("secondBrain")
    const feedback = useTranslations("toast")
    const format = useFormatter()
    const router = useWorkspaceRouter()
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const { categories } = useBrainDossiers()
    const dossierId = dossierIdOf(input, categories)
    const findingId = input.kind === "dossier" ? input.findingId : undefined
    const { dossier } = useDossierRecord(dossierId)
    const summary = useDossierReviewSummary()
    const list = useDossierFindings(queryOfDossier(dossierId), dossierId !== undefined, summary.revision)
    const commands = useDossierReviewCommands()
    const { rowOf } = useFindingRows()
    const [picked, setPicked] = useState<FindingFilter | undefined>(undefined)
    const openDraft = (finding: FindingView, draftId: string) => {
        if (dossierId !== undefined)
            router.replace(brainDossierHref(dossierId, { finding: finding.id, draft: draftId }))
    }
    const dialog = useFindingDialog(commands, list.members, openDraft)
    const closeDialog = dialog.close
    const [seenDossierId, setSeenDossierId] = useState(dossierId)
    if (seenDossierId !== dossierId) {
        setSeenDossierId(dossierId)
        if (dossierId === undefined) {
            setPicked(undefined)
            closeDialog()
        }
    }
    const findings = ("items" in list.slot ? list.slot.items : undefined) ?? []
    const focused = findings.find((one) => one.id === findingId)
    const filter = picked ?? (focused === undefined ? "open" : filterOfStatus(focused.status))
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    const act = (id: string, action: FindingAction) => {
        const finding = findings.find((one) => one.id === id)
        if (finding === undefined || dossierId === undefined) return
        const kind = DIALOG_OF_ACTION[action]
        if (kind !== undefined) dialog.open(kind, finding)
        else if (action === "confirm") commands.confirm(finding.id).catch(failed)
        else if (action === "reopen") commands.reopen(finding.id).catch(failed)
        else if (action === "viewDraft" && finding.draftId !== null) openDraft(finding, finding.draftId)
    }
    return {
        props: paneOf({
            dossierId,
            findingId,
            dossier,
            summary,
            list,
            dialog: dialog.view,
            rowOf,
            t,
            brain,
            format,
            slotLabels,
            canWrite: member.canWrite,
            isReviewPending: commands.isPending,
            filter,
            counts: findingCountsOf(findings, !list.hasNextPage),
        }),
        on: {
            setFilter: (value: string) => setPicked(dossierFilterOf(value, filter)),
            review: () => {
                if (dossierId !== undefined) commands.requestReview(dossierId).catch(failed)
            },
            action: act,
            loadMore: list.loadMore,
            retry: list.retry,
            submitDialog: (values: Parameters<typeof dialog.submit>[0]) => {
                dialog.submit(values).catch(failed)
            },
            closeDialog,
        },
    }
}
