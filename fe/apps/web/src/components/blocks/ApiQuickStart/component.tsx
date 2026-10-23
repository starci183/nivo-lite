import { Button, FencedCodeBlock, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { EXAMPLE_CLASS, STACK_CLASS } from "./classNames"

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
        readonly intro: string
        readonly examples: ReadonlyArray<QuickStartExample>
        readonly n8n: {
            readonly title: string
            readonly steps: string
            readonly examples: ReadonlyArray<QuickStartExample>
        }
    }
    readonly on: { readonly copy: (id: string, code: string) => void }
}

const example = (item: QuickStartExample, copy: (id: string, code: string) => void) => (
    <div key={item.id} className={EXAMPLE_CLASS}>
        <Heading level={3}>{item.title}</Heading>
        {item.note === undefined ? null : (
            <Text size="sm" tone="muted">
                {item.note}
            </Text>
        )}
        <FencedCodeBlock
            code={item.code}
            action={
                <Button variant="outline" size="sm" onPress={() => copy(item.id, item.code)}>
                    {item.copyLabel}
                </Button>
            }
        />
    </div>
)

/** Draws the quick start: base address, auth, limits, then copyable curl and n8n examples. */
export const ApiQuickStartBase = (props: ApiQuickStartBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">
                {props.props.intro}
            </Text>
            {props.props.examples.map((item) => example(item, props.on.copy))}
            <div className={EXAMPLE_CLASS}>
                <Heading level={3}>{props.props.n8n.title}</Heading>
                <Text size="sm" tone="muted">
                    {props.props.n8n.steps}
                </Text>
                {props.props.n8n.examples.map((item) => example(item, props.on.copy))}
            </div>
        </div>
    </SurfaceCard>
)
