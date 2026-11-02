import type { HiringViews } from "@/modules/types"
import type { ReactNode } from "react"

import { Button, Heading, Text, Textarea } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, PAIR_CLASS_NAME } from "./classNames"

interface CandidateActionsProps {
    readonly copy: Pick<HiringViews["workbenchCopy"], "candSchedule" | "candOffer" | "candShortlist" | "candReject">
    readonly canSchedule: boolean
    readonly canOffer: boolean
    readonly canShortlist: boolean
    readonly canReject: boolean
    readonly isBusy: boolean
    readonly on: {
        readonly openDialog: (dialog: HiringViews["candidateDialog"]) => void
        readonly shortlist: () => void
    }
}
interface CandidateResponsesProps {
    readonly copy: Pick<
        HiringViews["workbenchCopy"],
        "candAnswers" | "candNoAnswers" | "candInterviews" | "candOffers" | "candCancelOffer"
    >
    readonly answers: ReadonlyArray<HiringViews["candidateLine"]>
    readonly interviews: ReadonlyArray<HiringViews["candidateLine"]>
    readonly offers: ReadonlyArray<HiringViews["candidateLine"] & { readonly canCancel: boolean }>
    readonly isBusy: boolean
    readonly on: { readonly cancelOffer: (id: string) => void }
}
interface CandidateRecordsProps {
    readonly copy: Pick<
        HiringViews["workbenchCopy"],
        "candNotes" | "candNotesLabel" | "candNotesHint" | "candNotesSave" | "candHistory" | "candData" | "candDelete"
    >
    readonly notes: string
    readonly canSaveNotes: boolean
    readonly history: ReactNode
    readonly retention: string
    readonly isBusy: boolean
    readonly on: {
        readonly notes: (value: string) => void
        readonly saveNotes: () => void
        readonly delete: () => void
    }
}
/** Each candidate region accepts only its actual values and atomic actions. */
type HiringCandidateSectionsProps =
    | ({ readonly section: "actions" } & CandidateActionsProps)
    | ({ readonly section: "responses" } & CandidateResponsesProps)
    | ({ readonly section: "records" } & CandidateRecordsProps)

/** Resolved candidate details drawn at their position in the drawer. */
export const HiringCandidateSections = (props: HiringCandidateSectionsProps) => {
    if (props.section === "actions") return <CandidateActions {...props} />
    if (props.section === "responses") return <CandidateResponses {...props} />
    return <CandidateRecords {...props} />
}

/** Application answers and the candidate?s interviews and offers. */
const CandidateResponses = (props: CandidateResponsesProps) => {
    const { copy } = props
    const { on } = props
    return (
        <>
            <Heading level={3}>{copy.candAnswers}</Heading>
            {props.answers.length === 0 ? <Text tone="muted">{copy.candNoAnswers}</Text> : null}
            {props.answers.map((answer) => (
                <div key={answer.id} className={PAIR_CLASS_NAME}>
                    <Text size="sm" isStrong>
                        {answer.title}
                    </Text>
                    <Text size="sm">{answer.text}</Text>
                </div>
            ))}
            {props.interviews.length === 0 ? null : <Heading level={3}>{copy.candInterviews}</Heading>}
            {props.interviews.map((line) => (
                <Text key={line.id} size="sm">
                    {line.text}
                </Text>
            ))}
            {props.offers.length === 0 ? null : <Heading level={3}>{copy.candOffers}</Heading>}
            {props.offers.map((offer) => (
                <div key={offer.id} className={ACTIONS_CLASS_NAME}>
                    <Text size="sm">{offer.text}</Text>
                    {offer.canCancel ? (
                        <Button
                            intent="destructive"
                            step="entry"
                            size="sm"
                            isDisabled={props.isBusy}
                            onPress={() => on.cancelOffer(offer.id)}
                        >
                            {copy.candCancelOffer}
                        </Button>
                    ) : null}
                </div>
            ))}
        </>
    )
}

/** Notes, activity history and the candidate data retention controls. */
const CandidateRecords = (props: CandidateRecordsProps) => {
    const { copy } = props
    const { on } = props
    return (
        <>
            <Heading level={3}>{copy.candNotes}</Heading>
            <Textarea
                label={copy.candNotesLabel}
                isLabelHidden
                rows={3}
                value={props.notes}
                onValueChange={on.notes}
                description={copy.candNotesHint}
            />
            <div className={ACTIONS_CLASS_NAME}>
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={props.isBusy}
                    isDisabled={props.isBusy || !props.canSaveNotes}
                    onPress={on.saveNotes}
                >
                    {copy.candNotesSave}
                </Button>
            </div>
            <Heading level={3}>{copy.candHistory}</Heading>
            {props.history}
            <Heading level={3}>{copy.candData}</Heading>
            <Text size="sm" tone="muted">
                {props.retention}
            </Text>
            <div className={ACTIONS_CLASS_NAME}>
                <Button intent="destructive" step="entry" size="sm" onPress={on.delete}>
                    {copy.candDelete}
                </Button>
            </div>
        </>
    )
}

/** The next steps available at the candidate?s current stage. */
const CandidateActions = (props: CandidateActionsProps) => {
    const { copy } = props
    const { on } = props
    return (
        <div className={ACTIONS_CLASS_NAME}>
            <Button
                intent="commit"
                size="sm"
                isDisabled={!props.canSchedule}
                onPress={() => on.openDialog("interview")}
            >
                {copy.candSchedule}
            </Button>
            <Button intent="alternative" size="sm" isDisabled={!props.canOffer} onPress={() => on.openDialog("offer")}>
                {copy.candOffer}
            </Button>
            {props.canShortlist ? (
                <Button intent="dismiss" size="sm" isDisabled={props.isBusy} onPress={on.shortlist}>
                    {copy.candShortlist}
                </Button>
            ) : null}
            <Button
                intent="destructive"
                step="entry"
                size="sm"
                isDisabled={!props.canReject}
                onPress={() => on.openDialog("reject")}
            >
                {copy.candReject}
            </Button>
        </div>
    )
}
