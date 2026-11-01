import { Button, Cluster, FileDropzone, Form, Textarea } from "@starci/grammar/common"
import { FIELD } from "./classNames"

/** What the composer draws: the starts of a message, the field with its hint, the send action and the brand PDF. */
export interface AgentSetupComposerContent {
    /** The next missing gates as one-tap starts of a message. */
    readonly suggestions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly composerLabel: string
    /** "Ctrl+Enter to send · 0/4000". */
    readonly composerHint: string
    readonly text: string
    readonly sendLabel: string
    readonly isSending: boolean
    /** The brand guideline PDF the AI Marketing agent reads; null for the other agents. */
    readonly attach: {
        readonly label: string
        readonly prompt: string
        readonly isReading: boolean
    } | null
}

/** The words of the composer that are not part of the content. */
interface AgentSetupComposerCopy {
    readonly suggestionsLabel: string
    readonly formLabel: string
}

/** What the composer can do. */
interface AgentSetupComposerCommands {
    readonly text: (value: string) => void
    readonly send: () => void
    readonly suggest: (id: string) => void
    readonly attach: (files: ReadonlyArray<File>) => void
}

/** Content, copy and commands of the composer. */
interface AgentSetupComposerProps {
    readonly content: AgentSetupComposerContent
    readonly isSkeleton: boolean
    readonly copy: AgentSetupComposerCopy
    readonly on: AgentSetupComposerCommands
}

/** The composer: the next missing items as starts of a message, the field with its hint, the send action, the brand PDF. */
export const AgentSetupComposer = (props: AgentSetupComposerProps) => (
    <>
        {props.content.suggestions.length === 0 ? null : (
            <Cluster gap="row">
                {props.content.suggestions.map((suggestion) => (
                    <Button
                        key={suggestion.id}
                        intent="neutral"
                        size="sm"
                        isSkeleton={props.isSkeleton}
                        onPress={() => props.on.suggest(suggestion.id)}
                    >
                        {suggestion.label}
                    </Button>
                ))}
            </Cluster>
        )}
        <Form
            label={props.copy.formLabel}
            onSubmit={(_, event) => {
                event.preventDefault()
                props.on.send()
            }}
        >
            <Cluster gap="inline" align="end" wrap={false}>
                <div className={FIELD}>
                    <Textarea
                        id="setup-composer"
                        name="message"
                        label={props.content.composerLabel}
                        isLabelHidden
                        placeholder={props.content.composerLabel}
                        description={props.content.composerHint}
                        rows={2}
                        maxLength={4000}
                        value={props.content.text}
                        isSkeleton={props.isSkeleton}
                        isDisabled={props.content.isSending}
                        onValueChange={props.on.text}
                        onSubmitShortcut={props.on.send}
                    />
                </div>
                <Button
                    intent="commit"
                    isPending={props.content.isSending}
                    isDisabled={props.isSkeleton || props.content.text.trim().length === 0}
                    onPress={props.on.send}
                >
                    {props.content.sendLabel}
                </Button>
            </Cluster>
        </Form>
        {props.content.attach === null ? null : (
            <FileDropzone
                label={props.content.attach.label}
                accept=".pdf,application/pdf"
                prompt={props.content.attach.prompt}
                isDisabled={props.isSkeleton || props.content.attach.isReading}
                hideFileList
                onFilesChange={props.on.attach}
            />
        )}
    </>
)
