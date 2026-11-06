import type { useFormatter, useTranslations } from "next-intl"
import {
    confirmSidesOf,
    findingActionsOf,
    isActive,
    toPublicDocument,
    DOSSIER_STATUS_TONE,
    FINDING_FILTERS,
    selectionOf,
    type PublicDocument,
} from "@/modules/brain"
import type {
    CategoryView,
    EvidencePlaceView,
    FindingAction,
    FindingCardActionView,
    FindingView,
    MemberOption,
    DossierReviewRecord,
    ReviewedStatus,
    FindingFilter,
} from "@/modules/brain"
import { brainUploadHref, workspaceHref } from "@/modules/routes"
import type { DossierIdentity } from "./useDossierIdentities"
import type { Run } from "./usePublicDocRunner"

/** The words of the dossier review. */
export type Translate = ReturnType<typeof useTranslations<"dossierReview">>

/** The names of the three finding lists, in their existing order. */
export const DOSSIER_FILTER_KEY = { open: "filterOpen", confirmed: "filterConfirmed", closed: "filterClosed" } as const
/** Why the review's AI pass could not run. */
export const DOSSIER_AI_NOTICE_KEY = { credits: "aiSkippedCredits", budget: "aiSkippedBudget" } as const

/** Keeps a filter selection within the actual finding lists. */
export const dossierFilterOf = (value: string, fallback: FindingFilter): FindingFilter =>
    FINDING_FILTERS.find((one) => one === value) ?? fallback

/** The review's status and the checklist's status when they differ. */
export const dossierBadgesOf = (
    t: Translate,
    brain: ReturnType<typeof useTranslations<"secondBrain">>,
    standing: ReviewedStatus,
): (
    | {
          id: string
          label: string
          tone: "success" | "neutral" | "danger" | "warning" | "accent"
      }
    | {
          id: string
          label: string
          tone: "muted"
      }
)[] => [
    { id: "status", label: brain(`status_${standing.status}`), tone: DOSSIER_STATUS_TONE[standing.status] },
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
export const dossierReviewedLineOf = (
    t: Translate,
    format: ReturnType<typeof useFormatter>,
    review: DossierReviewRecord | undefined,
): string =>
    review === undefined
        ? t("neverReviewed")
        : t("reviewedAt", {
              time: format.dateTime(new Date(review.reviewedAt), { dateStyle: "medium", timeStyle: "short" }),
          })

/** Where a quote sits in its document, in words: "Trang 3", "Slide 2" or the name of the sheet. */
export const placeWordsOf =
    (t: Translate): ((place: EvidencePlaceView) => string) =>
    (place: EvidencePlaceView) =>
        t(`place_${place.kind}`, { label: place.label })

/** Where a finding stands, when that is worth saying: confirmed, dismissed, or how it was resolved; nothing for an open one. */
export const statusPartOf = (t: Translate, finding: FindingView): string | null => {
    if (finding.status === "open") return null
    if (finding.status === "resolved") return t(`resolution_${finding.resolution ?? "manual"}`)
    return t(finding.status === "confirmed" ? "confirmed" : "dismissed")
}

/** Who the finding is with; "unassigned" only while it still needs somebody. */
export const ownerPartOf = (
    t: Translate,
    finding: FindingView,
    members: ReadonlyArray<MemberOption>,
): string | null => {
    if (finding.assigneeId === null) return isActive(finding) ? t("unassigned") : null
    const person = members.find((one) => one.id === finding.assigneeId)
    return [t("assignee"), person?.label ?? "-"].join(": ")
}

/** What a card needs to know besides its finding. */
export interface FindingCardContext {
    readonly members: ReadonlyArray<MemberOption>
    readonly canWrite: boolean
    /** The dossier the finding is filed under, when it is known: what an upload files a document under. */
    readonly dossier: DossierIdentity | undefined
}

/** The order the actions of a card are offered in: the answer, the document, NIVO, someone else, done, and last skipping it. */
const ACTION_ORDER: ReadonlyArray<FindingAction> = [
    "confirm",
    "upload",
    "askDraft",
    "viewDraft",
    "assign",
    "markDone",
    "dismiss",
    "reopen",
]

/** The actions of a finding card, in the order they are offered, worded for the card. */
export const cardActionsOf = (
    t: Translate,
    finding: FindingView,
    context: FindingCardContext,
    workspaceId: string,
): ReadonlyArray<FindingCardActionView> => {
    const command = (id: FindingAction, label: string, intent: FindingCardActionView["intent"] = "neutral") => ({
        id,
        label,
        intent,
        href: null,
        command: id,
        note: null,
    })
    const upload = (): ReadonlyArray<FindingCardActionView> =>
        context.dossier === undefined
            ? []
            : [
                  {
                      id: "upload",
                      label: t(finding.kind === "contradiction" ? "cardUploadOther" : "cardUpload"),
                      intent: finding.kind === "contradiction" ? "neutral" : "commit",
                      href: workspaceHref(
                          workspaceId,
                          brainUploadHref(context.dossier.category, `dossier:${context.dossier.ref}`),
                      ),
                      command: null,
                      note: null,
                  },
              ]
    const wording: Readonly<Record<FindingAction, () => ReadonlyArray<FindingCardActionView>>> = {
        confirm: () =>
            confirmSidesOf(finding).map((source) => ({
                id: `confirm-${source}`,
                label: t("cardConfirmSide", { source }),
                intent: "neutral",
                href: null,
                command: "confirm",
                note: t("confirmNote", { source }),
            })),
        upload,
        askDraft: () => [command("askDraft", t("cardAskDraft"))],
        viewDraft: () => [command("viewDraft", t("viewDraft"))],
        assign: () => [command("assign", t("cardAssign"))],
        markDone: () => [command("markDone", t("cardDone"))],
        dismiss: () => [command("dismiss", t("cardSkip"), "dismiss")],
        reopen: () => [command("reopen", t("reopen"))],
    }
    const wanted = findingActionsOf(finding, context.canWrite)
    return ACTION_ORDER.filter((one) => wanted.includes(one)).flatMap((one) => wording[one]())
}

/** A command that changes a public document: the runner answers the saved snapshot, and `done` says what was done. */
export const documentCommandOf =
    <Request>(
        run: Run,
        send: (request: Request) => Promise<Parameters<typeof toPublicDocument>[0]>,
    ): ((request: Request, done?: string) => Promise<PublicDocument | undefined>) =>
    (request: Request, done?: string) =>
        run(async () => toPublicDocument(await send(request)), done)

/** A direct dossier pane, or a map node whose dossier must be proven by the actual map read. */
export type FindingsSelection =
    | { readonly kind: "dossier"; readonly dossierId: string; readonly findingId: string | undefined }
    | { readonly kind: "map"; readonly nodeId: string | undefined }

/** A map node resolves to its dossier only once the categories are read: until then no dossier is selected and the pane stays hidden. */
export const dossierIdOf = (
    input: FindingsSelection,
    categories: ReadonlyArray<CategoryView> | undefined,
): string | undefined => {
    if (input.kind === "dossier") return input.dossierId
    if (categories === undefined) return undefined
    const selected = selectionOf(categories, input.nodeId ?? null)
    return selected.kind === "dossier" ? selected.dossier.id : undefined
}
