import { Button, FencedCodeBlock, Heading, SurfaceCard, Text, Stack } from "@starci/grammar/common"
/** One copyable example, already in the reader's words. */
export interface QuickStartExample {
    readonly id: string
    readonly title: string
    readonly note?: string | undefined
    readonly code: string
    readonly copyLabel: string
}

/** Props for {@link ApiQuickStartBase}. */
export interface ApiQuickStartBaseProps {
    readonly props: {
        readonly title: string
        /** What the collapsed row lists, so the owner knows whether to open it. */
        readonly meta: string
        readonly isOpen: boolean
        readonly intro: string
        readonly examples: ReadonlyArray<QuickStartExample>
    }
    readonly on: {
        readonly copy: (id: string, code: string) => void
        readonly toggle: (isOpen: boolean) => void
    }
}

const example = (item: QuickStartExample, copy: (id: string, code: string) => void) => (
    <Stack gap="inline" key={item.id}>
        <Heading level={3}>{item.title}</Heading>
        {item.note === undefined ? null : (
            <Text size="sm" tone="muted">
                {item.note}
            </Text>
        )}
        <FencedCodeBlock
            code={item.code}
            action={
                <Button intent="neutral" size="sm" onPress={() => copy(item.id, item.code)}>
                    {item.copyLabel}
                </Button>
            }
        />
    </Stack>
)

/** Draws the quick start as one collapsed row: base address, auth, limits, then copyable curl examples when opened. */
export const ApiQuickStartBase = (props: ApiQuickStartBaseProps) => (
    <SurfaceCard
        kind="accordion"
        ariaLabel={props.props.title}
        onItemOpenChange={(_, isOpen) => props.on.toggle(isOpen)}
        items={[
            {
                id: "guide",
                title: props.props.title,
                meta: props.props.meta,
                isOpen: props.props.isOpen,
                body: (
                    <Stack gap="section">
                        <Text size="sm" tone="muted">
                            {props.props.intro}
                        </Text>
                        {props.props.examples.map((item) => example(item, props.on.copy))}
                    </Stack>
                ),
            },
        ]}
    />
)
