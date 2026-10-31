import { Input, Tabs, Textarea } from "@starci/grammar/common"
import type { ContentT } from "@/modules/types"
import { FIELDS_CLASS_NAME } from "./classNames"

/** The text of the channel that is open. */
export interface OpenVariant {
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
    readonly t: ContentT
    readonly onTab: (id: string) => void
    readonly onText: (text: string) => void
    readonly onNote: (note: string) => void
    readonly onTags: (text: string) => void
}

/** The text, hashtags and note of each channel of a post, one channel tab at a time. */
export const ContentEditorVariants = (props: ContentEditorVariantsProps) => (
    <>
        <Tabs
            label={props.t("fieldChannels")}
            selectedKey={props.open.id}
            inset="none"
            labelVisibility="always"
            items={props.tabs}
            onSelect={props.onTab}
        />
        <div className={FIELDS_CLASS_NAME}>
            <Textarea
                label={props.t("variantFor", { channel: props.open.label })}
                rows={9}
                value={props.open.text}
                isDisabled={!props.isEditable}
                description={props.t("variantChars", { n: props.open.text.length, max: props.open.maxChars })}
                onValueChange={props.onText}
            />
            {props.open.showTags ? (
                <Input
                    id={`ce-tags-${props.open.id}`}
                    name={`tags-${props.open.id}`}
                    label={props.t("fieldHashtags")}
                    value={props.open.tags}
                    description={props.t("fieldHashtagsHint")}
                    isDisabled={!props.isEditable}
                    onValueChange={props.onTags}
                />
            ) : null}
            <Textarea
                label={props.t("fieldNote")}
                rows={2}
                value={props.open.note}
                isDisabled={!props.isEditable}
                onValueChange={props.onNote}
            />
        </div>
    </>
)
