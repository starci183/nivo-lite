import type { ReactElement } from "react"
import {
    Alert,
    Button,
    Heading,
    Image,
    SectionHeader,
    Skeleton,
    Stepper,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import type { WorkspacesStatus } from "@/hooks/workspaces"
import { APP_ROUTES } from "@/modules/routes"
import { STACK_CLASS_NAME, WELCOME_COPY_CLASS_NAME } from "./classNames"

/** Copy and values the connected workspaces overview supplies. */
export interface WorkspacesOverviewBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly createLabel: string
        readonly createFirstLabel: string
        readonly welcomeTitle: string
        readonly welcomeText: string
        readonly welcomeStepsLabel: string
        readonly welcomeSteps: ReadonlyArray<string>
        /** The notice about why the person landed here; none draws nothing. */
        readonly reason?: string | undefined
        /** The failure of loading the list (already localized by the back end); none draws nothing. */
        readonly error?: string | undefined
        /** Where the list stands: loading, failed, empty or ready. */
        readonly status: WorkspacesStatus
        readonly loadFailedTitle: string
    }
}

/** Draws the first-run welcome card. */
const Welcome = (props: WorkspacesOverviewBaseProps) => (
    <SurfaceCard
        ariaLabel={props.props.welcomeTitle}
        treatment="ink"
        artwork={<Image src="/images/entry/workspace-welcome.png" alt="" aspect="square" fit="contain" plate="none" />}
    >
        <div className={WELCOME_COPY_CLASS_NAME}>
            <Heading level={2}>{props.props.welcomeTitle}</Heading>
            <Text tone="muted">{props.props.welcomeText}</Text>
            <Stepper
                label={props.props.welcomeStepsLabel}
                orientation="vertical"
                currentStepId="s0"
                steps={props.props.welcomeSteps.map((label, index) => ({ id: `s${index}`, label }))}
            />
            <Button intent="commit" size="lg" href={APP_ROUTES.workspaceNew}>
                {props.props.createFirstLabel}
            </Button>
        </div>
    </SurfaceCard>
)

/** Draws the placeholder while the list loads. */
const Loading = (props: WorkspacesOverviewBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title} composition="joined">
        <Skeleton shape="text" lines={3} />
    </SurfaceCard>
)

/** The body of each list status; a failed list draws only the alert above it. */
const BODY: Readonly<Record<WorkspacesStatus, (props: WorkspacesOverviewBaseProps) => ReactElement | null>> = {
    loading: Loading,
    error: () => null,
    empty: Welcome,
    ready: () => null,
}

/** Draws the workspaces overview: every workspace the person can open, the first-run welcome when there is none, and the way to join by link. */
export const WorkspacesOverviewBase = (props: WorkspacesOverviewBaseProps) => (
    <div className={STACK_CLASS_NAME}>
        <SectionHeader
            level={1}
            title={props.props.title}
            description={props.props.description}
            action={
                props.props.status === "ready" ? (
                    <Button intent="commit" size="lg" href={APP_ROUTES.workspaceNew}>
                        {props.props.createLabel}
                    </Button>
                ) : undefined
            }
        />
        {props.props.reason === undefined ? null : <Alert tone="cautionary" title={props.props.reason} />}
        {props.props.error === undefined ? null : (
            <Alert tone="negative" title={props.props.loadFailedTitle} description={props.props.error} />
        )}
        {BODY[props.props.status](props)}
    </div>
)
