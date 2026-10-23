import { Alert, Button, Input, Textarea } from "@starci/grammar/common"
import { PAIR_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** One question and its answer. */
export interface PairView {
    readonly id: string
    readonly q: string
    readonly a: string
}

/** The words, values and state of the panel that writes a note or a list of questions. */
type AddNotePanelProps = {
    readonly titleLabel: string
    readonly titleHint: string
    readonly title: string
    readonly titleError?: string | undefined
    /** The text of a written note; ignored when the panel writes questions. */
    readonly contentLabel: string
    readonly contentHint: string
    readonly content: string
    /** The questions and answers; when set the panel writes them instead of a text. */
    readonly pairs?: ReadonlyArray<PairView> | undefined
    readonly questionLabel: string
    readonly answerLabel: string
    readonly addLabel: string
    readonly removeLabel: string
    readonly contentError?: string | undefined
    readonly isBusy: boolean
    readonly onTitle: (value: string) => void
    readonly onContent: (value: string) => void
    readonly onPair: (id: string, field: "q" | "a", value: string) => void
    readonly onAddPair: () => void
    readonly onRemovePair: (id: string) => void
}

/** The name of a note and either its text or a list of questions with answers. */
export const AddNotePanel = (props: AddNotePanelProps) => (
    <div className={PANEL_CLASS_NAME}>
        <Input
            id="knowledge-add-title"
            name="title"
            label={props.titleLabel}
            variant="secondary"
            hint={props.titleHint}
            value={props.title}
            errorMessage={props.titleError}
            isError={props.titleError !== undefined}
            isDisabled={props.isBusy}
            onValueChange={props.onTitle}
        />
        {props.pairs === undefined ? (
            <Textarea
                id="knowledge-add-content"
                name="content"
                label={props.contentLabel}
                variant="secondary"
                rows={8}
                maxLength={120000}
                description={props.contentHint}
                value={props.content}
                errorMessage={props.contentError}
                isInvalid={props.contentError !== undefined}
                isDisabled={props.isBusy}
                onValueChange={props.onContent}
            />
        ) : (
            <>
                {props.pairs.map((pair) => (
                    <div key={pair.id} className={PAIR_CLASS_NAME}>
                        <Input
                            id={`knowledge-add-q-${pair.id}`}
                            name={`q-${pair.id}`}
                            label={props.questionLabel}
                            variant="secondary"
                            value={pair.q}
                            isDisabled={props.isBusy}
                            onValueChange={(value) => props.onPair(pair.id, "q", value)}
                        />
                        <Textarea
                            id={`knowledge-add-a-${pair.id}`}
                            name={`a-${pair.id}`}
                            label={props.answerLabel}
                            variant="secondary"
                            rows={3}
                            value={pair.a}
                            isDisabled={props.isBusy}
                            onValueChange={(value) => props.onPair(pair.id, "a", value)}
                        />
                        {props.pairs !== undefined && props.pairs.length > 1 ? (
                            <Button
                                variant="ghost"
                                isDisabled={props.isBusy}
                                onPress={() => props.onRemovePair(pair.id)}
                            >
                                {props.removeLabel}
                            </Button>
                        ) : null}
                    </div>
                ))}
                <Button variant="outline" isDisabled={props.isBusy} onPress={props.onAddPair}>
                    {props.addLabel}
                </Button>
                {props.contentError === undefined ? null : <Alert tone="negative" title={props.contentError} />}
            </>
        )}
    </div>
)
