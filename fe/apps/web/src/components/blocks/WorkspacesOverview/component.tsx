import { Alert, Button, Heading, Image, Stepper, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { APP_ROUTES } from "@/modules/routes"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { STACK_CLASS_NAME, WELCOME_COPY_CLASS_NAME } from "./classNames"

/** The workspaces overview shapes, in the order the owner approved them. */
export const WORKSPACES_OVERVIEW_SHAPES = ["welcome", "list"] as const
/** One drawing per shape: the first-run welcome of a person with no workspace, or the page of one who has some. */
export type WorkspacesOverviewShape = (typeof WORKSPACES_OVERVIEW_SHAPES)[number]

/** What the list read answers: how many workspaces the person can open. */
export interface WorkspacesCount {
    readonly count: number
}

/** Copy and values the connected workspaces overview supplies. */
export interface WorkspacesOverviewBaseProps {
    readonly shape: WorkspacesOverviewShape
    readonly props: {
        readonly createFirstLabel: string
        readonly welcomeTitle: string
        readonly welcomeText: string
        readonly welcomeStepsLabel: string
        readonly welcomeSteps: ReadonlyArray<string>
        /** The notice about why the person landed here; none draws nothing. */
        readonly reason?: string | undefined
        readonly slot: DataSlot<WorkspacesCount>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** What the list draws while its read is in flight: the first-run card, in skeleton. */
const COUNT_PLACEHOLDER: WorkspacesCount = { count: 0 }

/** What the welcome card draws from: the words of the overview, and whether they are placeholders. */
type WelcomeProps = Pick<WorkspacesOverviewBaseProps, "props"> & { readonly isSkeleton: boolean }

/** Draws the first-run welcome card; in skeleton its words rest as shapes. */
const Welcome = (props: WelcomeProps) => (
    <SurfaceCard
        ariaLabel={props.props.welcomeTitle}
        treatment="ink"
        artwork={<Image src="/images/entry/workspace-welcome.png" alt="" aspect="square" fit="contain" plate="none" />}
    >
        <div className={WELCOME_COPY_CLASS_NAME}>
            <Heading level={2} isSkeleton={props.isSkeleton}>
                {props.props.welcomeTitle}
            </Heading>
            <Text tone="muted" isSkeleton={props.isSkeleton}>
                {props.props.welcomeText}
            </Text>
            <Stepper
                label={props.props.welcomeStepsLabel}
                orientation="vertical"
                currentStepId="s0"
                isLoading={props.isSkeleton}
                steps={props.props.welcomeSteps.map((label, index) => ({ id: `s${index}`, label }))}
            />
            <Button intent="commit" href={APP_ROUTES.workspaceNew} isSkeleton={props.isSkeleton}>
                {props.props.createFirstLabel}
            </Button>
        </div>
    </SurfaceCard>
)

/** Draws the workspaces overview body: the reason notice, and the first-run welcome when there is no workspace. */
export const WorkspacesOverviewBase = (props: WorkspacesOverviewBaseProps) => (
    <div className={STACK_CLASS_NAME}>
        {props.props.reason === undefined ? null : <Alert tone="cautionary" title={props.props.reason} />}
        <SlotView
            slot={props.props.slot}
            placeholder={COUNT_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(_, isSkeleton) =>
                props.shape === "welcome" || isSkeleton ? <Welcome props={props.props} isSkeleton={isSkeleton} /> : null
            }
        </SlotView>
    </div>
)
