import { RadioGroup } from "@starci/grammar/common"

/** One choice of who may read a document. */
export interface VisibilityChoiceView {
    readonly id: string
    readonly label: string
}

/** The words and values of the choice of who may read a document. */
export interface AddVisibilityView {
    readonly label: string
    /** What the chosen audience means for the answers of the agents, in plain words. */
    readonly consequence: string
    readonly value: string
    readonly options: ReadonlyArray<VisibilityChoiceView>
}

/** The words, values and state of the choice of who may read a document. */
interface AddVisibilityPanelProps extends AddVisibilityView {
    readonly isBusy: boolean
    readonly onChange: (value: string) => void
}

/** Who may read the documents being added, always in view: the choice decides whether the customer chatbot can answer from them. */
export const AddVisibilityPanel = (props: AddVisibilityPanelProps) => (
    <RadioGroup
        label={props.label}
        name="visibility"
        description={props.consequence}
        options={props.options.map((one) => ({ value: one.id, label: one.label }))}
        value={props.value}
        isDisabled={props.isBusy}
        onValueChange={props.onChange}
    />
)
