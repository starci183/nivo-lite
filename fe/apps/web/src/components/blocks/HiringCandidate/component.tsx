import { Alert, AlertDialog, Badge, Drawer, Text, type BadgeTone } from "@starci/grammar/common"

import { HiringCvSection, type HiringCvSectionProps } from "@/components/composites/HiringCvSection"

import { HiringInterviewDialog, type HiringInterviewDialogProps } from "@/components/composites/HiringInterviewDialog"

import { HiringOfferDialog, type HiringOfferDialogProps } from "@/components/composites/HiringOfferDialog"

import { HiringRejectDialog, type HiringRejectDialogProps } from "@/components/composites/HiringRejectDialog"

import { HiringScoreSection, type HiringScoreSectionProps } from "@/components/composites/HiringScoreSection"

import type { HiringSay } from "@/modules/types"
import { CHIPS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"
import { HiringCandidateSections } from "@/components/composites/HiringCandidateSections"

/** The text fields of the interview request form. */
export type InterviewTextField = "interviewerUserId" | "mode" | "location"

/** The text fields of the offer request form. */
export type OfferTextField = "title" | "pay" | "startDate" | "probation" | "note"

/** The dialogs the candidate drawer opens. */
export type CandidateDialogKind = "interview" | "offer" | "reject" | "delete"

/** One line of text with an id and an optional heading line: an answer, an interview, an offer, an event. */
interface CandidateLineView {
    readonly id: string
    readonly title: string
    readonly text: string
}

/** What the connected block settled for the candidate drawer. */
export interface HiringCandidateBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly isOpen: boolean
        readonly name: string
        readonly subtitle: string
        readonly stageLabel: string
        readonly stageTone: BadgeTone
        readonly contacts: ReadonlyArray<string>
        readonly canSchedule: boolean
        readonly canOffer: boolean
        readonly canShortlist: boolean
        readonly canReject: boolean
        readonly score: HiringScoreSectionProps["props"]["score"]
        readonly cv: Omit<HiringCvSectionProps["props"], "say">
        readonly answers: ReadonlyArray<CandidateLineView>
        readonly interviews: ReadonlyArray<CandidateLineView>
        readonly offers: ReadonlyArray<CandidateLineView & { readonly canCancel: boolean }>
        /** Undefined while the timeline is still loading. */
        readonly events: ReadonlyArray<CandidateLineView> | undefined
        readonly notes: string
        readonly canSaveNotes: boolean
        readonly retention: string
        readonly dialog: CandidateDialogKind | null
        readonly isBusy: boolean
        readonly error: string | null
        readonly notice: string | null
        readonly interview: HiringInterviewDialogProps["props"]
        readonly offer: HiringOfferDialogProps["props"]
        readonly reject: HiringRejectDialogProps["props"]
    }
    readonly on: {
        readonly openDialog: (dialog: CandidateDialogKind) => void
        readonly closeDialog: () => void
        readonly shortlist: () => void
        readonly rescreen: () => void
        readonly toggleCv: () => void
        readonly notes: (value: string) => void
        readonly saveNotes: () => void
        readonly cancelOffer: (id: string) => void
        readonly remove: () => void
        readonly clear: () => void
        readonly close: () => void
        readonly interviewText: (name: InterviewTextField, value: string) => void
        readonly interviewNumber: (name: "durationMin", value: number) => void
        readonly sendInterview: () => void
        readonly offerText: (name: OfferTextField, value: string) => void
        readonly sendOffer: () => void
        readonly rejectReason: (value: string) => void
        readonly confirmReject: () => void
    }
}

/** Draws the drawer of one candidate: contact, screening, CV, answers, interviews, offers, notes, timeline and the next steps. */
export const HiringCandidateBase = (props: HiringCandidateBaseProps) => {
    const p = props.props
    const { say } = p
    const { on } = props
    if (!p.isOpen) return null
    return (
        <>
            <Drawer
                isOpen
                onOpenChange={(open) => {
                    if (!open) on.close()
                }}
                title={p.name}
                description={p.subtitle}
                closeLabel={say("close")}
                placement="right"
            >
                <div className={FORM_CLASS_NAME}>
                    {p.error === null ? null : (
                        <Alert
                            tone="negative"
                            title={say("errorTitle")}
                            description={p.error}
                            dismissLabel={say("dismiss")}
                            onDismiss={on.clear}
                        />
                    )}
                    {p.notice === null ? null : (
                        <Alert tone="informative" title={p.notice} dismissLabel={say("dismiss")} onDismiss={on.clear} />
                    )}
                    <div className={CHIPS_CLASS_NAME}>
                        <Badge tone={p.stageTone} isDot>
                            {p.stageLabel}
                        </Badge>
                        {p.contacts.map((line) => (
                            <Text key={line} as="span" size="sm">
                                {line}
                            </Text>
                        ))}
                    </div>
                    <HiringCandidateSections {...props} section="actions" />{" "}
                    <HiringScoreSection
                        props={{ say, score: p.score, isBusy: p.isBusy }}
                        on={{ rescreen: on.rescreen }}
                    />
                    <HiringCvSection props={{ say, ...p.cv }} on={{ toggle: on.toggleCv }} />
                    <HiringCandidateSections {...props} section="responses" />
                    <HiringCandidateSections {...props} section="records" />{" "}
                </div>
            </Drawer>
            <CandidateDialogs {...props} />{" "}
        </>
    )
}

/** The active interview, offer, rejection or deletion dialog. */
const CandidateDialogs = (props: HiringCandidateBaseProps) => {
    const p = props.props
    const { say } = p
    const { on } = props
    return (
        <>
            {p.dialog === "interview" ? (
                <HiringInterviewDialog
                    props={p.interview}
                    on={{
                        text: on.interviewText,
                        number: on.interviewNumber,
                        send: on.sendInterview,
                        close: on.closeDialog,
                    }}
                />
            ) : null}
            {p.dialog === "offer" ? (
                <HiringOfferDialog
                    props={p.offer}
                    on={{ text: on.offerText, send: on.sendOffer, close: on.closeDialog }}
                />
            ) : null}
            {p.dialog === "reject" ? (
                <HiringRejectDialog
                    props={p.reject}
                    on={{ reason: on.rejectReason, confirm: on.confirmReject, close: on.closeDialog }}
                />
            ) : null}
            {p.dialog === "delete" ? (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) on.closeDialog()
                    }}
                    tone="negative"
                    title={say("deleteTitle", { name: p.name })}
                    description={say("deleteBody")}
                    confirmLabel={say("deleteConfirm")}
                    cancelLabel={say("cancel")}
                    isConfirmPending={p.isBusy}
                    onConfirm={on.remove}
                >
                    <Text>{say("deleteWhen")}</Text>
                </AlertDialog>
            ) : null}
        </>
    )
}
