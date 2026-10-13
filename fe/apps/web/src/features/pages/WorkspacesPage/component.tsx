import { Alert, Button, Heading, Image, SectionHeader, Stepper, SurfaceCard, Text } from "@starci/grammar/common"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { LocaleSwitch } from "@/components/blocks/LocaleSwitch"
import { WorkspaceJoin } from "@/components/blocks/WorkspaceJoin"
import { WorkspacesAccount } from "@/components/blocks/WorkspacesAccount"
import { WorkspacesList } from "@/components/blocks/WorkspacesList"
import { WorkspacesFrame } from "@/components/composites/WorkspacesFrame"
import type { WorkspaceCardView } from "@/hooks/workspaces"
import { APP_ROUTES, AUTH_ROUTES } from "@/modules/routes"
import {
    STACK_CLASS_NAME,
    WELCOME_ART_CLASS_NAME,
    WELCOME_COPY_CLASS_NAME,
    WELCOME_GRID_CLASS_NAME,
    WELCOME_IMAGE_CLASS_NAME,
} from "./classNames"

/** Copy and values the workspaces page supplies. */
export interface WorkspacesPageBaseProps {
    readonly props: {
        readonly email: string
        readonly title: string
        readonly description: string
        readonly createLabel: string
        readonly createFirstLabel: string
        readonly welcomeTitle: string
        readonly welcomeText: string
        readonly welcomeStepsLabel: string
        readonly welcomeSteps: ReadonlyArray<string>
        /** The notice about why the person landed here; none draws nothing. */
        readonly reason?: string
        readonly workspaces: ReadonlyArray<WorkspaceCardView>
    }
}

/** Draws the workspaces screen: every workspace the person can open, the first-run welcome when there is none, and the way to join by link. */
export const WorkspacesPageBase = (props: WorkspacesPageBaseProps) => (
    <WorkspacesFrame
        homeHref={AUTH_ROUTES.workspaces}
        mainLabel={props.props.title}
        logo={<BrandLogo variant="full" height={44} />}
        localeSwitch={<LocaleSwitch />}
        account={
            <WorkspacesAccount
                email={props.props.email}
                hasWorkspace={props.props.workspaces.some((workspace) => workspace.state === "active")}
            />
        }
    >
        <div className={STACK_CLASS_NAME}>
            <SectionHeader
                level={1}
                title={props.props.title}
                description={props.props.description}
                action={
                    props.props.workspaces.length === 0 ? undefined : (
                        <Button variant="primary" size="lg" href={APP_ROUTES.workspaceNew}>
                            {props.props.createLabel}
                        </Button>
                    )
                }
            />
            {props.props.reason === undefined ? null : <Alert tone="cautionary" title={props.props.reason} />}
            {props.props.workspaces.length === 0 ? (
                <SurfaceCard ariaLabel={props.props.welcomeTitle} composition="joined">
                    <div className={WELCOME_GRID_CLASS_NAME}>
                        <div className={WELCOME_COPY_CLASS_NAME}>
                            <Heading level={2}>{props.props.welcomeTitle}</Heading>
                            <Text tone="muted">{props.props.welcomeText}</Text>
                            <Stepper
                                label={props.props.welcomeStepsLabel}
                                orientation="vertical"
                                currentStepId="s0"
                                steps={props.props.welcomeSteps.map((label, index) => ({ id: `s${index}`, label }))}
                            />
                            <Button variant="primary" size="lg" href={APP_ROUTES.workspaceNew}>
                                {props.props.createFirstLabel}
                            </Button>
                        </div>
                        {/* SURFACE-6 hero band: the page's one brand signature moment (DISCIPLINE-3). */}
                        <div className={WELCOME_ART_CLASS_NAME} aria-hidden="true">
                            <div className={WELCOME_IMAGE_CLASS_NAME}>
                                <Image
                                    src="/images/entry/workspace-welcome.png"
                                    alt=""
                                    aspect="square"
                                    fit="contain"
                                    plate="none"
                                />
                            </div>
                        </div>
                    </div>
                </SurfaceCard>
            ) : (
                <WorkspacesList workspaces={props.props.workspaces} />
            )}
            <WorkspaceJoin />
        </div>
    </WorkspacesFrame>
)
