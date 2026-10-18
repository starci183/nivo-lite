import { useEffect, useRef } from "react"
import { Button, Fieldset, Icon, Text, Textarea } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeComposerProps } from "@/modules/types"
import { CHIPS_CLASS_NAME, COMPOSER_CLASS_NAME, FIELD_CLASS_NAME, HINT_CLASS_NAME, ROW_CLASS_NAME } from "./classNames"

/** Resolves quick questions, including the optional connected chatbot. */
const promptsOf = (view: OfficeComposerProps["props"]): ReadonlyArray<string> => [
    view.text("promptNivoAuthority"),
    view.text("promptNivoExceptions"),
    view.text("promptAttention"),
    view.text("promptSummary"),
    view.text("promptInvoices"),
    ...(view.chatbotHandle === null ? [] : [view.text("promptChatbot", { handle: view.chatbotHandle })]),
]

/** The pinned composer: a slim row of quick questions, then "@", the message field and Send. */
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
        <div className={COMPOSER_CLASS_NAME}>
            <Fieldset legend={text("quickLabel")} isLegendHidden>
                <div className={CHIPS_CLASS_NAME}>
                    {prompts.map((prompt) => (
                        <Button
                            key={prompt}
                            variant="secondary"
                            size="sm"
                            isDisabled={view.isLoading}
                            onPress={() => onPrompt(prompt)}
                        >
                            {prompt}
                        </Button>
                    ))}
                </div>
            </Fieldset>
            <div className={ROW_CLASS_NAME}>
                <Button variant="ghost" aria-label={text("mentionButton")} isDisabled={view.isLoading} onPress={onAt}>
                    @
                </Button>
                <div ref={hostRef} className={FIELD_CLASS_NAME}>
                    <Textarea
                        label={text("composerLabel")}
                        isLabelHidden
                        variant="secondary"
                        placeholder={text("composerPlaceholder")}
                        rows={1}
                        isSkeleton={view.isLoading}
                        value={view.draft}
                        onValueChange={props.on.change}
                        onSubmitShortcut={props.on.send}
                        mentions={{ options: view.mentions, label: text("mentionLabel") }}
                    />
                </div>
                <Button
                    variant="primary"
                    isPending={view.isSending}
                    isDisabled={view.isLoading || view.draft.trim().length === 0}
                    onPress={props.on.send}
                    startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}
                >
                    {text("send")}
                </Button>
            </div>
            <div className={HINT_CLASS_NAME}>
                <Text size="xs" tone="muted">
                    {text("composerHint")}
                </Text>
            </div>
        </div>
    )
}
