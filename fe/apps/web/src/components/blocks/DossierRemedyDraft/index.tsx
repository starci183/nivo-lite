"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { useSlotLabels } from "@/hooks/slot"
import {
    queryOfDossier,
    useDossierFindings,
    useDossierRemedyDraft,
    useDossierReviewCommands,
    useFindingRows,
} from "@/hooks/brain"
import type { DraftView } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainDossierHref, brainTabHref } from "@/modules/routes"
import { DossierRemedyDraftBase } from "./component"

/** Props for the connected draft drawer: what the address asks of it. */
interface DossierRemedyDraftProps {
    /** The draft the address points at; the drawer is open while there is one. */
    readonly draftId: string | undefined
    /** The dossier the drawer returns to when it closes, and whose findings hold the one the draft answers. */
    readonly dossierId: string | undefined
    readonly findingId: string | undefined
}

/** What the person changed in the draft, and which draft it was. */
interface DraftEdit {
    readonly draftId: string
    readonly title: string
    readonly body: string
}

/** A draft of the same shape as a ready one, drawn as geometry while it is read. */
const PLACEHOLDER: DraftView = {
    id: "placeholder",
    findingId: "placeholder",
    status: "proposed",
    title: "-",
    body: "-",
    placeholders: [],
}

/** The connected draft drawer: the draft NIVO wrote, which the owner edits and approves into the dossier, or turns down. */
export const DossierRemedyDraft = (props: DossierRemedyDraftProps) => {
    const t = useTranslations("dossierReview")
    const router = navigation.useRouter()
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const commands = useDossierReviewCommands()
    const draft = useDossierRemedyDraft(props.draftId)
    const findings = useDossierFindings(queryOfDossier(props.dossierId), props.draftId !== undefined)
    const { rowOf } = useFindingRows()
    const [edit, setEdit] = useState<DraftEdit | null>(null)
    const current = draft.slot.items
    const edited = edit !== null && edit.draftId === props.draftId ? edit : null
    const finding = findings.slot.items?.find((one) => one.id === current?.findingId)
    const row =
        finding === undefined
            ? undefined
            : rowOf(finding, { members: [], canWrite: false, focusedId: undefined, showDossier: false, upload: null })
    const close = () =>
        router.replace(
            props.dossierId === undefined
                ? brainTabHref("dossiers")
                : brainDossierHref(props.dossierId, { finding: props.findingId }),
        )
    const save = async (draftId: string, title: string, body: string): Promise<boolean> => {
        const saved = await commands.saveDraft(draftId, title, body)
        if (saved) setEdit(null)
        return saved
    }
    const title = edited?.title ?? current?.title ?? ""
    const body = edited?.body ?? current?.body ?? ""
    const saveEdit = async () => {
        if (props.draftId !== undefined) await save(props.draftId, title, body)
    }
    const reject = async () => {
        if (props.draftId !== undefined && (await commands.rejectDraft(props.draftId, ""))) close()
    }
    const approve = async () => {
        if (props.draftId === undefined) return
        if (edited !== null && !(await save(props.draftId, title, body))) return
        if (await commands.approveDraft(props.draftId)) close()
    }
    return (
        <DossierRemedyDraftBase
            props={{
                isOpen: props.draftId !== undefined,
                title: t("draftTitle"),
                closeLabel: t("close"),
                note: t("draftNote"),
                titleFieldLabel: t("draftTitleField"),
                bodyFieldLabel: t("draftBodyField"),
                placeholdersTitle: t("draftPlaceholders"),
                evidenceTitle: t("evidenceTitle", { count: row?.evidence.length ?? 0 }),
                findingTitle: row?.title ?? null,
                evidence: row?.evidence ?? [],
                notice: noticeOf(t, current),
                slot: draft.slot,
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("draftFailed")),
                draftTitle: title,
                draftBody: body,
                canDecide: member.canWrite && current?.status === "proposed",
                isDirty: edited !== null,
                isPending: commands.isPending,
                rejectLabel: t("rejectDraft"),
                saveLabel: t("saveDraft"),
                approveLabel: t("approveDraft"),
            }}
            on={{
                close,
                setTitle: (value) => setEdit({ draftId: props.draftId ?? "", title: value, body }),
                setBody: (value) => setEdit({ draftId: props.draftId ?? "", title, body: value }),
                save: () => void saveEdit(),
                reject: () => void reject(),
                approve: () => void approve(),
                retry: draft.reload,
            }}
        />
    )
}

type Translate = ReturnType<typeof useTranslations<"dossierReview">>

/** The line about where the draft stands, when it is more than proposed: being written, failed, filed or turned down. */
const noticeOf = (t: Translate, draft: DraftView | undefined) => {
    if (draft === undefined) return null
    const words = {
        generating: { tone: "pending", title: t("draftGenerating") },
        failed: { tone: "negative", title: t("draftFailed") },
        approved: { tone: "affirmative", title: t("approved") },
        rejected: { tone: "neutral", title: t("rejected") },
    } as const
    return draft.status === "proposed" ? null : { ...words[draft.status], description: undefined }
}
