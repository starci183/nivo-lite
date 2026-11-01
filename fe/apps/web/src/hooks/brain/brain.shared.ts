import type { useTranslations } from "next-intl"
import { confirmSidesOf, findingActionsOf, isActive } from "@/modules/brain"
import type {
    EvidencePlaceView,
    FindingAction,
    FindingCardActionView,
    FindingView,
    MemberOption,
} from "@/modules/brain"
import { brainUploadHref } from "@/modules/routes"
import type { DossierIdentity } from "./useDossierIdentities"

/** The words of the dossier review. */
export type Translate = ReturnType<typeof useTranslations<"dossierReview">>

/** Where a quote sits in its document, in words: "Trang 3", "Slide 2" or the name of the sheet. */
export const placeWordsOf = (t: Translate) => (place: EvidencePlaceView) =>
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
                      href: brainUploadHref(context.dossier.category, `dossier:${context.dossier.ref}`),
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
