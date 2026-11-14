import { Alert, Button, Dialog, FencedCodeBlock, Heading, Input, Stack, Text } from "@starci/grammar/common"

/** The shown-once dialog: the secret and, for an MCP key, the command with the secret filled in. */
export interface FreshKeyView {
    readonly title: string
    readonly closeLabel: string
    readonly warning: string
    readonly keyLabel: string
    readonly value: string
    readonly copyLabel: string
    readonly copiedLabel: string
    /** The command to paste (an MCP key whose address the API published), else absent. */
    readonly snippet?: { readonly title: string; readonly code: string; readonly copyLabel: string } | undefined
    /** A neutral line when an MCP key has no published address to put in a command. */
    readonly snippetNote?: string | undefined
    readonly doneLabel: string
}

/** Props for {@link FreshKeyDialog}. */
interface FreshKeyDialogProps {
    readonly fresh: FreshKeyView
    readonly on: { readonly dismiss: () => void; readonly copySnippet: (code: string) => void }
}

/** The once-shown key: a neutral note, the secret with its copy, the Claude Code command with the secret in it, and the one way out. */
export const FreshKeyDialog = (props: FreshKeyDialogProps) => {
    const fresh = props.fresh
    const snippet = fresh.snippet
    return (
        <Dialog
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.dismiss()
            }}
            title={fresh.title}
            closeLabel={fresh.closeLabel}
            isDismissable={false}
            footer={
                <Button intent="neutral" onPress={props.on.dismiss}>
                    {fresh.doneLabel}
                </Button>
            }
        >
            <Stack gap="section">
                <Alert tone="informative" title={fresh.warning} />
                <Input
                    id="api-key-fresh"
                    name="apiKey"
                    label={fresh.keyLabel}
                    value={fresh.value}
                    isReadOnly
                    isCopyable
                    copyLabel={fresh.copyLabel}
                    copiedLabel={fresh.copiedLabel}
                />
                {snippet === undefined ? null : (
                    <Stack gap="inline">
                        <Heading level={3}>{snippet.title}</Heading>
                        <FencedCodeBlock
                            code={snippet.code}
                            action={
                                <Button intent="neutral" size="sm" onPress={() => props.on.copySnippet(snippet.code)}>
                                    {snippet.copyLabel}
                                </Button>
                            }
                        />
                    </Stack>
                )}
                {fresh.snippetNote === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {fresh.snippetNote}
                    </Text>
                )}
            </Stack>
        </Dialog>
    )
}
