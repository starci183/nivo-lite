import { useEffect, useRef } from "react"
import {
    Alert,
    Button,
    Cluster,
    Fieldset,
    Icon,
    IconButton,
    PaneSection,
    Text,
    Textarea,
    Tooltip,
} from "@starci/grammar/common"
import { ChatFileChosen } from "@/components/branches/ChatFileChosen"
import { ChatFilePicker } from "@/components/branches/ChatFilePicker"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeComposerProps } from "@/modules/types"
import { FIELD_CLASS_NAME, HINT_CLASS_NAME } from "./classNames"

/** What the row of quick questions draws and reports. */
type QuickPromptsProps = {
    readonly view: OfficeComposerProps["props"]
    readonly prompts: ReadonlyArray<string>
    readonly onPrompt: (prompt: string) => void
}

/** The row of quick questions above the field. */
const QuickPrompts = (props: QuickPromptsProps) => (
    <Fieldset legend={props.view.copy.quickLabel} isLegendHidden>
        <Cluster gap="inline">
            {props.prompts.map((prompt) => (
                <Button
                    key={prompt}
                    intent="neutral"
                    size="sm"
                    isDisabled={props.view.isLoading}
                    onPress={() => props.onPrompt(prompt)}
                >
                    {prompt}
                </Button>
            ))}
        </Cluster>
    </Fieldset>
)

/** What the line above the field reads. */
type ComposerFileProps = { readonly view: OfficeComposerProps["props"]; readonly onClear: () => void }

/** What is said about the chosen file above the field: why it cannot go, or its name. */
const ComposerFile = (props: ComposerFileProps) => {
    const { view } = props
    const { name, problem } = view.file
    return (
        <>
            {problem === null ? null : <Alert tone="negative" title={problem} />}
            {name === null ? null : (
                <ChatFileChosen
                    name={name}
                    removeLabel={view.copy.removeFile}
                    isDisabled={view.isSending}
                    onRemove={props.onClear}
                />
            )}
        </>
    )
}

/** The pinned composer as two bands of its pane: a slim row of quick questions reaching both edges, then "@", the message field and Send over the hint. */
export const OfficeComposer = (props: OfficeComposerProps) => {
    const view = props.props
    const { copy } = view
    const hostRef = useRef<HTMLDivElement | null>(null)
    const prompts = view.prompts
    const fileName = view.file.name

    const focusField = () => hostRef.current?.querySelector("textarea")?.focus()

    useEffect(() => {
        if (view.focusKey > 0) hostRef.current?.querySelector("textarea")?.focus()
    }, [view.focusKey])

    const onAt = () => {
        props.on.change(`${view.draft}${view.draft !== "" && !view.draft.endsWith(" ") ? " " : ""}@`)
        focusField()
    }

    const onPrompt = (prompt: string) => {
        props.on.change(prompt)
        focusField()
    }

    return (
        <>
            <PaneSection bleed="inline">
                <QuickPrompts view={view} prompts={prompts} onPrompt={onPrompt} />
            </PaneSection>
            <PaneSection gap="inline">
                <ComposerFile view={view} onClear={props.on.clearFile} />
                <Cluster gap="inline" align="end" wrap={false}>
                    <ChatFilePicker
                        label={copy.attachFile}
                        accept={view.file.accept}
                        isDisabled={view.isLoading || view.isSending}
                        onFile={props.on.chooseFile}
                    />
                    <Tooltip
                        content={copy.mentionButton}
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("mention", "leading")}
                                label={copy.mentionButton}
                                isDisabled={view.isLoading}
                                onPress={onAt}
                            />
                        }
                    />
                    <div ref={hostRef} className={FIELD_CLASS_NAME}>
                        <Textarea
                            label={copy.composerLabel}
                            isLabelHidden
                            placeholder={copy.composerPlaceholder}
                            rows={3}
                            isLoading={view.isLoading}
                            value={view.draft}
                            onValueChange={props.on.change}
                            onSubmitShortcut={props.on.send}
                            mentions={{ options: view.mentions, label: copy.mentionLabel }}
                        />
                    </div>
                    <Button
                        intent="commit"
                        isPending={view.isSending}
                        isDisabled={view.isLoading || (view.draft.trim().length === 0 && fileName === null)}
                        onPress={props.on.send}
                        startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}
                    >
                        {copy.send}
                    </Button>
                </Cluster>
                <ComposerHint label={copy.composerHint} />
            </PaneSection>
        </>
    )
}

interface ComposerHintProps {
    readonly label: string
}
/** The resolved composer instruction keeps its existing inline measure. */
const ComposerHint = (props: ComposerHintProps) => (
    <div className={HINT_CLASS_NAME}>
        <Text size="xs" tone="muted">
            {props.label}
        </Text>
    </div>
)
