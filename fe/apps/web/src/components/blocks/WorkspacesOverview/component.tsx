import { Alert, Button, Heading, Mascot, Stepper, SurfaceCard, Text, Stack } from "@starci/grammar/common"
import { APP_ROUTES } from "@/modules/routes"

/** The workspaces overview shapes, in the order the owner approved them. */
export const WORKSPACES_OVERVIEW_SHAPES = ["welcome", "list"] as const
/** One drawing per shape: the first-run welcome of a person with no workspace, or the page of one who has some. */
export type WorkspacesOverviewShape = (typeof WORKSPACES_OVERVIEW_SHAPES)[number]

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
    }
}

/** What the welcome card draws from: the words of the overview, and whether they are placeholders. */
type WelcomeProps = Pick<WorkspacesOverviewBaseProps, "props"> & { readonly isSkeleton: boolean }

/** Draws the first-run welcome card on the soft surface with the lobby mascot; in skeleton its words rest as shapes. */
const Welcome = (props: WelcomeProps) => (
    <SurfaceCard
        ariaLabel={props.props.welcomeTitle}
        treatment="soft"
        artwork={
            <Mascot
                src="/images/entry/lobby-welcome.webp"
                size="lg"
                loading="eager"
                assetSlot="lobby-welcome"
                assetSha256="b2a5858380490746ec3d76a43d669439e518f9d8af80545fcbedd89ef566899b"
                assetPrompt="The NIVO unicorn waves hello and holds a small golden heart key, sparkles, transparent ground"
            />
        }
    >
        <Stack gap="section" align="start">
            <Heading level={2} isLoading={props.isSkeleton}>
                {props.props.welcomeTitle}
            </Heading>
            <Text tone="muted" isLoading={props.isSkeleton}>
                {props.props.welcomeText}
            </Text>
            <Stepper
                label={props.props.welcomeStepsLabel}
                orientation="vertical"
                currentStepId="s0"
                isLoading={props.isSkeleton}
                steps={props.props.welcomeSteps.map((label, index) => ({ id: `s${index}`, label }))}
            />
            <Button intent="commit" href={APP_ROUTES.workspaceNew} isLoading={props.isSkeleton}>
                {props.props.createFirstLabel}
            </Button>
        </Stack>
    </SurfaceCard>
)

/** Draws the workspaces overview body: the reason notice, and the first-run welcome when there is no workspace. The list owns its own loading and failure. */
export const WorkspacesOverviewBase = (props: WorkspacesOverviewBaseProps) => (
    <Stack gap="region">
        {props.props.reason === undefined ? null : <Alert tone="cautionary" title={props.props.reason} />}
        {props.shape === "welcome" ? <Welcome props={props.props} isSkeleton={false} /> : null}
    </Stack>
)
