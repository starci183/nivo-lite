import { Stack, Disclosure, Input, Select } from "@starci/grammar/common"

/** One choice of a select or a radio group. */
interface ChoiceView {
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
    readonly topic: string
    readonly tags: string
    readonly module: string
    readonly moduleOptions: ReadonlyArray<ChoiceView>
    /** The muted line at the end of the trigger: what the batch is filed under now. */
    readonly summary?: string
    readonly isBusy: boolean
    readonly onTopic: (value: string) => void
    readonly onTags: (value: string) => void
    readonly onModule: (value: string | null) => void
}

/** The options that apply to the whole batch: topic, tags and the agent that uses it. */
export const AddOptionsPanel = (props: AddOptionsPanelProps) => (
    <Disclosure
        title={props.title}
        {...(props.summary === undefined ? {} : { summary: props.summary })}
        body={
            <Stack gap="section">
                <Input
                    id="knowledge-add-topic"
                    name="topic"
                    label={props.topicLabel}
                    description={props.topicHint}
                    value={props.topic}
                    isDisabled={props.isBusy}
                    onValueChange={props.onTopic}
                />
                <Input
                    id="knowledge-add-tags"
                    name="tags"
                    label={props.tagsLabel}
                    description={props.tagsHint}
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
            </Stack>
        }
    />
)
