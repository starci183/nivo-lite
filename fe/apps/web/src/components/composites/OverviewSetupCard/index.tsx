import { Cluster, IconButton, Link, Meter, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the setup card draws and how its disclosure is driven. */
interface OverviewSetupCardProps {
    readonly data: OverviewPaneReady["setup"]
    readonly copy: OverviewPaneCopy
    /** Every step is listed when open; the progress and the one next step show when closed. */
    readonly isOpen: boolean
    readonly onToggle: () => void
    readonly isLoading: boolean
}

/** The state a step row reads: done, the one next step, or still waiting. */
const stateOf = (isDone: boolean, isNext: boolean): "affirmative" | "informative" | "neutral" => {
    if (isDone) return "affirmative"
    return isNext ? "informative" : "neutral"
}

/** One step as a row: done, the one next step with its action, or still waiting. */
const stepRowOf = (
    step: OverviewPaneReady["setup"]["steps"][number],
    nextKey: string | undefined,
    done: string,
): ListRowData => {
    const isNext = step.key === nextKey
    return {
        id: step.key,
        title: step.label,
        state: stateOf(step.done, isNext),
        ...(isNext ? { description: step.hint, action: { label: step.cta, href: step.href } as const } : {}),
        leading: { icon: nivoIconSource(step.done ? "complete" : "pending", "leading") },
        ...(step.done ? { badges: [{ label: done, tone: "success" }] as const } : {}),
    }
}

/** What the end of the card head draws: the progress and its toggle. */
interface HeadEndProps {
    readonly progress: string
    readonly toggleLabel: string
    readonly isOpen: boolean
    readonly onToggle: () => void
    readonly isLoading: boolean
}

/** The disclosure at the end of the card head: the progress, then the toggle. */
const HeadEnd = (props: HeadEndProps) => (
    <Cluster gap="inline">
        <Text size="xs" tone="muted" isLoading={props.isLoading}>
            {props.progress}
        </Text>
        <IconButton
            intent="neutral"
            source={nivoIconSource("disclosure", "leading")}
            label={props.toggleLabel}
            aria-expanded={props.isOpen}
            onPress={props.onToggle}
            isLoading={props.isLoading}
        />
    </Cluster>
)

/** What the closed card draws. */
interface SummaryProps {
    readonly data: OverviewPaneReady["setup"]
    readonly copy: OverviewPaneCopy
    readonly isLoading: boolean
}

/** The progress meter and the one next step: the closed card. */
const Summary = (props: SummaryProps) => (
    <Stack gap="row">
        <Meter
            label={props.copy.setupProgressLabel}
            value={props.data.done}
            minValue={0}
            maxValue={Math.max(props.data.steps.length, 1)}
            valueLabel={props.data.progress}
            tone="informative"
            isLoading={props.isLoading}
        />
        <Cluster gap="row" justify="between">
            <Text size="sm" isLoading={props.isLoading}>
                {`${props.copy.setupNext} ${props.data.next?.label ?? ""}`}
            </Text>
            {props.data.next === null ? null : <Link href={props.data.next.href}>{props.data.next.cta}</Link>}
        </Cluster>
    </Stack>
)

/**
 * The setup card of the overview: the progress and the one next step, every step when opened, and one line once all are done.
 * The skeleton keeps the closed card's meter and line.
 */
export const OverviewSetupCard = (props: OverviewSetupCardProps) => {
    const { copy, data } = props
    const head = (
        <HeadEnd
            progress={data.progress}
            toggleLabel={props.isOpen ? copy.toggleHide : copy.toggleShow}
            isOpen={props.isOpen}
            onToggle={props.onToggle}
            isLoading={props.isLoading}
        />
    )
    if (data.isComplete) {
        return (
            <SurfaceCard label={copy.setupTitle} headingLevel={2} fact={data.progress}>
                <output>
                    <Text isStrong>{copy.setupAllSet}</Text>
                </output>
            </SurfaceCard>
        )
    }
    if (props.isOpen) {
        return (
            <SurfaceCard
                kind="list"
                label={copy.setupTitle}
                headingLevel={2}
                labelEnd={head}
                isLoading={props.isLoading}
                empty={<Text>{copy.setupAllSet}</Text>}
                items={data.steps.map((step) => stepRowOf(step, data.next?.key, copy.doneLabel))}
            />
        )
    }
    return (
        <SurfaceCard label={copy.setupTitle} headingLevel={2} labelEnd={head} isLoading={props.isLoading}>
            <Summary data={data} copy={copy} isLoading={props.isLoading} />
        </SurfaceCard>
    )
}
