import { Disclosure, Input, RadioGroup, Select } from "@starci/grammar/common"
import { PANEL_CLASS_NAME } from "./classNames"

/** One choice of a select or a radio group. */
export interface ChoiceView {
    readonly id: string
    readonly label: string
}

/** The words, values and state of the options of a batch. */
type AddOptionsPanelProps = {
    readonly title: string
    readonly topicLabel: string
    readonly topicHint: string
    readonly tagsLabel: string
    readonly tagsHint: string
    readonly moduleLabel: string
    readonly visibilityLabel: string
    readonly topic: string
    readonly tags: string
    readonly module: string
    readonly visibility: string
    readonly moduleOptions: ReadonlyArray<ChoiceView>
    readonly visibilityOptions: ReadonlyArray<ChoiceView>
    readonly isBusy: boolean
    readonly onTopic: (value: string) => void
    readonly onTags: (value: string) => void
    readonly onModule: (value: string | null) => void
    readonly onVisibility: (value: string) => void
}

/** The options that apply to the whole batch: topic, tags, the agent that uses it and who may read it. */
export const AddOptionsPanel = (props: AddOptionsPanelProps) => (
    <Disclosure title={props.title}>
        <div className={PANEL_CLASS_NAME}>
            <Input
                id="knowledge-add-topic"
                name="topic"
                label={props.topicLabel}
                hint={props.topicHint}
                value={props.topic}
                isDisabled={props.isBusy}
                onValueChange={props.onTopic}
            />
            <Input
                id="knowledge-add-tags"
                name="tags"
                label={props.tagsLabel}
                hint={props.tagsHint}
                value={props.tags}
                isDisabled={props.isBusy}
                onValueChange={props.onTags}
            />
            <Select
                label={props.moduleLabel}
                name="module"
                options={props.moduleOptions}
                value={props.module}
                isDisabled={props.isBusy}
                onValueChange={props.onModule}
            />
            <RadioGroup
                label={props.visibilityLabel}
                name="visibility"
                options={props.visibilityOptions.map((one) => ({ value: one.id, label: one.label }))}
                value={props.visibility}
                isDisabled={props.isBusy}
                onValueChange={props.onVisibility}
            />
        </div>
    </Disclosure>
)
