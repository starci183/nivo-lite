import { Button, FencedCodeBlock, Input, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** One copyable snippet: the client it is for and the text. */
export interface ClaudeSnippetView {
    readonly id: string
    readonly title: string
    readonly note: string
    readonly code: string
    readonly copyLabel: string
}

/** The MCP address as the card draws it: the address the API published, or a neutral note when there is none to show. */
export type ClaudeAddressView =
    { readonly kind: "url"; readonly url: string } | { readonly kind: "note"; readonly text: string }

/** Props for {@link ClaudeConnectCardBase}. */
export interface ClaudeConnectCardBaseProps {
    readonly props: {
        readonly title: string
        readonly intro: string
        readonly addressTitle: string
        readonly addressLabel: string
        readonly address: ClaudeAddressView
        readonly copyLabel: string
        readonly copiedLabel: string
        /** The snippets; empty while there is no address to put in them. */
        readonly snippets: ReadonlyArray<ClaudeSnippetView>
        /** The one neutral line on Claude Desktop and claude.ai connectors (they need OAuth, which comes later). */
        readonly connectors: { readonly title: string; readonly text: string }
        /** The note under the card: what Claude reads from customers is data, not instructions. */
        readonly dataNote: string
        /** The row ids that are open. */
        readonly openIds: ReadonlyArray<string>
    }
    readonly on: {
        readonly copy: (id: string, code: string) => void
        readonly toggle: (id: string, isOpen: boolean) => void
    }
}

/** The address row: the address to copy, or the neutral note when there is none to show. */
interface AddressBodyProps {
    readonly view: ClaudeConnectCardBaseProps["props"]
}

/** The address row body. */
const AddressBody = (props: AddressBodyProps) =>
    props.view.address.kind === "url" ? (
        <Input
            id="mcp-endpoint"
            name="mcpEndpoint"
            label={props.view.addressLabel}
            isLabelHidden
            value={props.view.address.url}
            isReadOnly
            isCopyable
            copyLabel={props.view.copyLabel}
            copiedLabel={props.view.copiedLabel}
        />
    ) : (
        <Text size="sm" tone="muted">
            {props.view.address.text}
        </Text>
    )

/** Draws "Connect with Claude": the MCP address to copy, a ready snippet for Claude Code and its project file, one line on the connectors, and the data note at the foot. */
export const ClaudeConnectCardBase = (props: ClaudeConnectCardBaseProps) => {
    const view = props.props
    const isOpen = (id: string) => view.openIds.includes(id)
    return (
        <SurfaceCard
            kind="accordion"
            label={view.title}
            headingLevel={2}
            note={view.intro}
            onItemOpenChange={props.on.toggle}
            items={[
                {
                    id: "address",
                    title: view.addressTitle,
                    isOpen: isOpen("address"),
                    body: <AddressBody view={view} />,
                },
                ...view.snippets.map((snippet) => ({
                    id: snippet.id,
                    title: snippet.title,
                    isOpen: isOpen(snippet.id),
                    body: (
                        <Stack gap="inline">
                            <Text size="sm" tone="muted">
                                {snippet.note}
                            </Text>
                            <FencedCodeBlock
                                code={snippet.code}
                                action={
                                    <Button
                                        intent="neutral"
                                        size="sm"
                                        onPress={() => props.on.copy(snippet.id, snippet.code)}
                                    >
                                        {snippet.copyLabel}
                                    </Button>
                                }
                            />
                        </Stack>
                    ),
                })),
                {
                    id: "connectors",
                    title: view.connectors.title,
                    isOpen: isOpen("connectors"),
                    body: (
                        <Text size="sm" tone="muted">
                            {view.connectors.text}
                        </Text>
                    ),
                },
            ]}
            footers={[
                {
                    kind: "custom",
                    children: (
                        <Text size="xs" tone="muted">
                            {view.dataNote}
                        </Text>
                    ),
                },
            ]}
        />
    )
}
