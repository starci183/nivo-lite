import type { ContentViews } from "@/modules/types"

import { Input, Stack, Tabs, Textarea } from "@starci/grammar/common"

/** The text of the channel that is open. */
interface OpenVariant {
    readonly fieldLabel: string
    readonly characterLabel: string
    readonly id: string
    readonly label: string
    readonly text: string
    readonly note: string
    readonly tags: string
    readonly maxChars: number
    readonly showTags: boolean
}

/** Props of {@link ContentEditorVariants}. */
interface ContentEditorVariantsProps {
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly open: OpenVariant
    readonly isEditable: boolean
    readonly copy: ContentViews["workbenchCopy"]
    readonly onTab: (id: string) => void
    readonly onText: (text: string) => void
    readonly onNote: (note: string) => void
    readonly onTags: (text: string) => void
}

/** The text, hashtags and note of each channel of a post, one channel tab at a time. */
export const ContentEditorVariants = (props: ContentEditorVariantsProps) => (
    <>
        <Tabs
            label={props.copy.fieldChannels}
            selectedKey={props.open.id}
            inset="none"
            labelVisibility="always"
            items={props.tabs}
            onSelect={props.onTab}
        />
        <Stack gap="row">
            <Textarea
                label={props.open.fieldLabel}
                rows={9}
                value={props.open.text}
                isDisabled={!props.isEditable}
                description={props.open.characterLabel}
                onValueChange={props.onText}
            />
            {props.open.showTags ? (
                <Input
                    id={`ce-tags-${props.open.id}`}
                    name={`tags-${props.open.id}`}
                    label={props.copy.fieldHashtags}
                    value={props.open.tags}
                    description={props.copy.fieldHashtagsHint}
                    isDisabled={!props.isEditable}
                    onValueChange={props.onTags}
                />
            ) : null}
            <Textarea
                label={props.copy.fieldNote}
                rows={2}
                value={props.open.note}
                isDisabled={!props.isEditable}
                onValueChange={props.onNote}
            />
        </Stack>
    </>
)
