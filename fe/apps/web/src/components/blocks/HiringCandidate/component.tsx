import { Alert, AlertDialog, Badge, Button, Drawer, Heading, Text, Textarea } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { HiringCvSection } from "@/components/composites/HiringCvSection"
import type { HiringCvSectionProps } from "@/components/composites/HiringCvSection"
import { HiringInterviewDialog } from "@/components/composites/HiringInterviewDialog"
import type { HiringInterviewDialogProps } from "@/components/composites/HiringInterviewDialog"
import { HiringOfferDialog } from "@/components/composites/HiringOfferDialog"
import type { HiringOfferDialogProps } from "@/components/composites/HiringOfferDialog"
import { HiringRejectDialog } from "@/components/composites/HiringRejectDialog"
import type { HiringRejectDialogProps } from "@/components/composites/HiringRejectDialog"
import { HiringScoreSection } from "@/components/composites/HiringScoreSection"
import type { HiringScoreSectionProps } from "@/components/composites/HiringScoreSection"
import type { FieldOf, HiringSay } from "@/hooks/hiring"
import type { CandidateDialog, InterviewValues, OfferValues } from "@/hooks/hiringCandidate"
import { ACTIONS_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, PAIR_CLASS_NAME, EVENTS_CLASS_NAME } from "./classNames"

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
        readonly dialog: CandidateDialog | null
        readonly isBusy: boolean
        readonly error: string | null
        readonly notice: string | null
        readonly interview: HiringInterviewDialogProps["props"]
        readonly offer: HiringOfferDialogProps["props"]
        readonly reject: HiringRejectDialogProps["props"]
    }
    readonly on: {
        readonly openDialog: (dialog: CandidateDialog) => void
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
        readonly interviewText: (name: FieldOf<InterviewValues, string>, value: string) => void
        readonly interviewNumber: (name: FieldOf<InterviewValues, number>, value: number) => void
        readonly sendInterview: () => void
        readonly offerText: (name: FieldOf<OfferValues, string>, value: string) => void
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
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button
                            variant="primary"
                            size="sm"
                            isDisabled={!p.canSchedule}
                            onPress={() => on.openDialog("interview")}
                        >
                            {say("candSchedule")}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            isDisabled={!p.canOffer}
                            onPress={() => on.openDialog("offer")}
                        >
                            {say("candOffer")}
                        </Button>
                        {p.canShortlist ? (
                            <Button variant="tertiary" size="sm" isDisabled={p.isBusy} onPress={on.shortlist}>
                                {say("candShortlist")}
                            </Button>
                        ) : null}
                        <Button
                            variant="danger-soft"
                            size="sm"
                            isDisabled={!p.canReject}
                            onPress={() => on.openDialog("reject")}
                        >
                            {say("candReject")}
                        </Button>
                    </div>
                    <HiringScoreSection
                        props={{ say, score: p.score, isBusy: p.isBusy }}
                        on={{ rescreen: on.rescreen }}
                    />
                    <HiringCvSection props={{ say, ...p.cv }} on={{ toggle: on.toggleCv }} />
                    <Heading level={3}>{say("candAnswers")}</Heading>
                    {p.answers.length === 0 ? <Text tone="muted">{say("candNoAnswers")}</Text> : null}
                    {p.answers.map((answer) => (
                        <div key={answer.id} className={PAIR_CLASS_NAME}>
                            <Text size="sm" weight="medium">
                                {answer.title}
                            </Text>
                            <Text size="sm">{answer.text}</Text>
                        </div>
                    ))}
                    {p.interviews.length === 0 ? null : <Heading level={3}>{say("candInterviews")}</Heading>}
                    {p.interviews.map((line) => (
                        <Text key={line.id} size="sm">
                            {line.text}
                        </Text>
                    ))}
                    {p.offers.length === 0 ? null : <Heading level={3}>{say("candOffers")}</Heading>}
                    {p.offers.map((offer) => (
                        <div key={offer.id} className={ACTIONS_CLASS_NAME}>
                            <Text size="sm">{offer.text}</Text>
                            {offer.canCancel ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    isDisabled={p.isBusy}
                                    onPress={() => on.cancelOffer(offer.id)}
                                >
                                    {say("candCancelOffer")}
                                </Button>
                            ) : null}
                        </div>
                    ))}
                    <Heading level={3}>{say("candNotes")}</Heading>
                    <Textarea
                        label={say("candNotesLabel")}
                        isLabelHidden
                        variant="secondary"
                        rows={3}
                        value={p.notes}
                        onValueChange={on.notes}
                        description={say("candNotesHint")}
                    />
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button
                            variant="secondary"
                            size="sm"
                            isPending={p.isBusy}
                            isDisabled={p.isBusy || !p.canSaveNotes}
                            onPress={on.saveNotes}
                        >
                            {say("candNotesSave")}
                        </Button>
                    </div>
                    <Heading level={3}>{say("candHistory")}</Heading>
                    {p.events === undefined ? <Text tone="muted">{say("loading")}</Text> : null}
                    {p.events?.length === 0 ? <Text tone="muted">{say("candNoHistory")}</Text> : null}
                    {p.events?.map((event) => (
                        <div key={event.id} className={EVENTS_CLASS_NAME}>
                            <Text size="sm">{event.title}</Text>
                            <Text size="xs" tone="muted">
                                {event.text}
                            </Text>
                        </div>
                    ))}
                    <Heading level={3}>{say("candData")}</Heading>
                    <Text size="sm" tone="muted">
                        {p.retention}
                    </Text>
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button variant="danger-soft" size="sm" onPress={() => on.openDialog("delete")}>
                            {say("candDelete")}
                        </Button>
                    </div>
                </div>
            </Drawer>
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
