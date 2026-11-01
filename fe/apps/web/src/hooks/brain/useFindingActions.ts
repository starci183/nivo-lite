"use client"

import { DIALOG_OF_ACTION } from "@/modules/brain"
import type { FindingCardActionView, FindingView, MemberOption } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainDossierHref } from "@/modules/routes"
import { useDossierReviewCommands } from "./useDossierReviewCommands"
import { useFindingDialog } from "./useFindingDialog"

/**
 * What a card of the queue does when one of its actions is pressed: a short task opens its dialog, a confirmation or reopening
 * goes straight to the back end, and a draft opens in the drawer of its dossier. Gives the dialog the pressed action opened.
 */
export const useFindingActions = (findings: ReadonlyArray<FindingView>, members: ReadonlyArray<MemberOption>) => {
    const router = navigation.useRouter()
    const commands = useDossierReviewCommands()
    const openDraft = (finding: FindingView, draftId: string) => {
        if (finding.dossierId === null) return
        router.replace(brainDossierHref(finding.dossierId, { finding: finding.id, draft: draftId }))
    }
    const dialog = useFindingDialog(commands, members, openDraft)
    const act = (findingId: string, action: FindingCardActionView) => {
        const finding = findings.find((one) => one.id === findingId)
        if (finding === undefined || action.command === null) return
        const kind = DIALOG_OF_ACTION[action.command]
        if (kind !== undefined) dialog.open(kind, finding)
        else if (action.command === "confirm") void commands.confirm(finding.id, action.note ?? undefined)
        else if (action.command === "reopen") void commands.reopen(finding.id)
        else if (action.command === "viewDraft" && finding.draftId !== null) openDraft(finding, finding.draftId)
    }
    return { act, dialog }
}
