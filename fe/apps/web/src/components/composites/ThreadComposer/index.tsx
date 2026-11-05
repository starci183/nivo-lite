import { useRef } from "react"
import { Button, Cluster, Icon, IconButton, PaneSection, Text, Textarea, Tooltip } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ComposerOption } from "@/modules/types"
import { FIELD_CLASS_NAME, HINT_CLASS_NAME } from "./classNames"

/** The words and state of the composer. */
interface ThreadComposerProps {
    readonly label: string
    readonly placeholder: string
    readonly hint: string
    readonly mentionLabel: string
    readonly sendLabel: string
    readonly draft: string
    /** The people, agents and groups the at sign offers. */
    readonly options: ReadonlyArray<ComposerOption>
    readonly isSending: boolean
    /** The thread is still being read: the field draws as geometry and stays empty. */
    readonly isLoading: boolean
    readonly onDraft: (value: string) => void
    readonly onPick: (option: ComposerOption) => void
    readonly onSend: () => void
}

/** The composer pinned under the thread: "@", the message field with its list of people, agents and groups, and Send, over the hint. */
export const ThreadComposer = (props: ThreadComposerProps) => {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const canSend = props.draft.trim().length > 0
    const onAt = () => {
        props.onDraft(`${props.draft}${props.draft !== "" && !props.draft.endsWith(" ") ? " " : ""}@`)
        hostRef.current?.querySelector("textarea")?.focus()
    }
    return (
        <PaneSection gap="inline">
            <Cluster gap="inline" align="end" wrap={false}>
                <Tooltip
                    content={props.mentionLabel}
                    trigger={
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("mention", "leading")}
                            label={props.mentionLabel}
                            isLoading={props.isLoading}
                            onPress={onAt}
                        />
                    }
                />
                <div ref={hostRef} className={FIELD_CLASS_NAME}>
                    <Textarea
                        id="thread-message"
                        label={props.label}
                        isLabelHidden
                        rows={1}
                        isLoading={props.isLoading}
                        placeholder={props.placeholder}
                        value={props.draft}
                        onValueChange={props.onDraft}
                        onSubmitShortcut={() => {
                            if (canSend) props.onSend()
                        }}
                        mentions={{ options: props.options, label: props.mentionLabel, onSelect: props.onPick }}
                    />
                </div>
                <Button
                    intent="commit"
                    isPending={props.isSending}
                    isLoading={props.isLoading}
                    onPress={() => {
                        if (canSend) props.onSend()
                    }}
                    startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}
                >
                    {props.sendLabel}
                </Button>
            </Cluster>
            <div className={HINT_CLASS_NAME}>
                <Text size="xs" tone="muted" isLoading={props.isLoading}>
                    {props.hint}
                </Text>
            </div>
        </PaneSection>
    )
}
