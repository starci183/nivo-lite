import { useEffect, useRef } from "react"
import {
    Button,
    Cluster,
    Fieldset,
    HorizontalScrollRegion,
    Icon,
    IconButton,
    PaneSection,
    Text,
    Textarea,
    Tooltip,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeComposerProps } from "@/modules/types"
import { FIELD_CLASS_NAME, HINT_CLASS_NAME } from "./classNames"

/** Resolves quick questions, including the optional connected chatbot. */
const promptsOf = (view: OfficeComposerProps["props"]): ReadonlyArray<string> => [
    view.text("promptNivoAuthority"),
    view.text("promptNivoExceptions"),
    view.text("promptAttention"),
    view.text("promptSummary"),
    view.text("promptInvoices"),
    ...(view.chatbotHandle === null ? [] : [view.text("promptChatbot", { handle: view.chatbotHandle })]),
]

/** What the row of quick questions draws and reports. */
type QuickPromptsProps = {
    readonly view: OfficeComposerProps["props"]
    readonly prompts: ReadonlyArray<string>
    readonly onPrompt: (prompt: string) => void
}

/** The row of quick questions above the field. */
const QuickPrompts = (props: QuickPromptsProps) => (
    <Fieldset legend={props.view.text("quickLabel")} isLegendHidden>
        <HorizontalScrollRegion
            overflow="needed"
            aria-label={props.view.text("quickLabel")}
            scrollPreviousLabel={props.view.text("quickPrevious")}
            scrollNextLabel={props.view.text("quickNext")}
        >
            <Cluster gap="inline" wrap={false}>
                {props.prompts.map((prompt) => (
                    <Button
                        key={prompt}
                        intent="neutral"
                        size="sm"
                        isDisabled={props.view.isSkeleton}
                        onPress={() => props.onPrompt(prompt)}
                    >
                        {prompt}
                    </Button>
                ))}
            </Cluster>
        </HorizontalScrollRegion>
    </Fieldset>
)

/** The pinned composer as two bands of its pane: a slim row of quick questions reaching both edges, then "@", the message field and Send over the hint. */
export const OfficeComposer = (props: OfficeComposerProps) => {
    const view = props.props
    const { text } = view
    const hostRef = useRef<HTMLDivElement | null>(null)
    const prompts = promptsOf(view)

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
                <Cluster gap="inline" align="end" wrap={false}>
                    <Tooltip content={text("mentionButton")}>
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("mention", "leading")}
                            label={text("mentionButton")}
                            isDisabled={view.isSkeleton}
                            onPress={onAt}
                        />
                    </Tooltip>
                    <div ref={hostRef} className={FIELD_CLASS_NAME}>
                        <Textarea
                            label={text("composerLabel")}
                            isLabelHidden
                            placeholder={text("composerPlaceholder")}
                            rows={3}
                            isSkeleton={view.isSkeleton}
                            value={view.draft}
                            onValueChange={props.on.change}
                            onSubmitShortcut={props.on.send}
                            mentions={{ options: view.mentions, label: text("mentionLabel") }}
                        />
                    </div>
                    <Button
                        intent="commit"
                        isPending={view.isSending}
                        isDisabled={view.isSkeleton || view.draft.trim().length === 0}
                        onPress={props.on.send}
                        startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}
                    >
                        {text("send")}
                    </Button>
                </Cluster>
                <div className={HINT_CLASS_NAME}>
                    <Text size="xs" tone="muted">
                        {text("composerHint")}
                    </Text>
                </div>
            </PaneSection>
        </>
    )
}
