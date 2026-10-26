import { Button, Heading, Text, Textarea } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import type { CandidateDialog } from "@/hooks/hiringCandidate"
import { ACTIONS_CLASS_NAME, PAIR_CLASS_NAME, EVENTS_CLASS_NAME } from "./classNames"

/** A resolved answer, appointment, offer or timeline entry. */
interface CandidateLineView {
    readonly id: string
    readonly title: string
    readonly text: string
}

/** Copy and commands needed by the candidate sections. */
interface CandidateSectionContentProps {
    readonly props: {
        readonly say: HiringSay
        readonly canSchedule: boolean
        readonly canOffer: boolean
        readonly canShortlist: boolean
        readonly canReject: boolean
        readonly isBusy: boolean
        readonly answers: ReadonlyArray<CandidateLineView>
        readonly interviews: ReadonlyArray<CandidateLineView>
        readonly offers: ReadonlyArray<CandidateLineView & { readonly canCancel: boolean }>
        readonly notes: string
        readonly canSaveNotes: boolean
        readonly events: ReadonlyArray<CandidateLineView> | undefined
        readonly retention: string
    }
    readonly on: {
        readonly openDialog: (dialog: CandidateDialog) => void
        readonly shortlist: () => void
        readonly cancelOffer: (id: string) => void
        readonly notes: (value: string) => void
        readonly saveNotes: () => void
    }
}

/** Which section of the candidate drawer to draw. */
interface HiringCandidateSectionsProps extends CandidateSectionContentProps {
    readonly section: "actions" | "responses" | "records"
}

/** Resolved candidate details drawn at their position in the drawer. */
export const HiringCandidateSections = (props: HiringCandidateSectionsProps) => {
    if (props.section === "actions") return <CandidateActions props={props.props} on={props.on} />
    if (props.section === "responses") return <CandidateResponses props={props.props} on={props.on} />
    return <CandidateRecords props={props.props} on={props.on} />
}

/** Application answers and the candidate?s interviews and offers. */
const CandidateResponses = (props: CandidateSectionContentProps) => {
    const p = props.props
    const { say } = p
    const { on } = props
    return (
        <>
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
                            intent="destructive"
                            step="entry"
                            size="sm"
                            isDisabled={p.isBusy}
                            onPress={() => on.cancelOffer(offer.id)}
                        >
                            {say("candCancelOffer")}
                        </Button>
                    ) : null}
                </div>
            ))}
        </>
    )
}

/** Notes, activity history and the candidate data retention controls. */
const CandidateRecords = (props: CandidateSectionContentProps) => {
    const p = props.props
    const { say } = p
    const { on } = props
    return (
        <>
            <Heading level={3}>{say("candNotes")}</Heading>
            <Textarea
                label={say("candNotesLabel")}
                isLabelHidden
                rows={3}
                value={p.notes}
                onValueChange={on.notes}
                description={say("candNotesHint")}
            />
            <div className={ACTIONS_CLASS_NAME}>
                <Button
                    intent="neutral"
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
                <Button intent="destructive" step="entry" size="sm" onPress={() => on.openDialog("delete")}>
                    {say("candDelete")}
                </Button>
            </div>
        </>
    )
}

/** The next steps available at the candidate?s current stage. */
const CandidateActions = (props: CandidateSectionContentProps) => {
    const p = props.props
    const { say } = p
    const { on } = props
    return (
        <div className={ACTIONS_CLASS_NAME}>
            <Button intent="commit" size="sm" isDisabled={!p.canSchedule} onPress={() => on.openDialog("interview")}>
                {say("candSchedule")}
            </Button>
            <Button intent="alternative" size="sm" isDisabled={!p.canOffer} onPress={() => on.openDialog("offer")}>
                {say("candOffer")}
            </Button>
            {p.canShortlist ? (
                <Button intent="dismiss" size="sm" isDisabled={p.isBusy} onPress={on.shortlist}>
                    {say("candShortlist")}
                </Button>
            ) : null}
            <Button
                intent="destructive"
                step="entry"
                size="sm"
                isDisabled={!p.canReject}
                onPress={() => on.openDialog("reject")}
            >
                {say("candReject")}
            </Button>
        </div>
    )
}
