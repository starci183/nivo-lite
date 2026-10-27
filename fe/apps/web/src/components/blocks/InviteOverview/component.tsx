import { Button, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { INVITE_STACK_CLASS_NAME } from "./classNames"

/** The invitation shapes, in the order the owner approved them. */
export const INVITE_OVERVIEW_SHAPES = ["unavailable", "signedOut", "mismatch", "ready"] as const
/** One drawing per visitor: a link that cannot be used, a signed-out visitor, another account, or the matching one. */
export type InviteOverviewShape = (typeof INVITE_OVERVIEW_SHAPES)[number]

/** Everything the invitation card draws, in the visitor's words. */
export interface InviteOverviewView {
    readonly title: string
    readonly body: string
    readonly forEmail: string
    readonly asStaff?: string | undefined
    readonly signedOutHint: string
    readonly signInLabel: string
    readonly signUpLabel: string
    readonly goSignInLabel: string
    readonly loginHref: string
    readonly signInHref: string
    readonly signUpHref: string
    readonly mismatchTitle: string
    readonly mismatchBody: string
    readonly signedInAs: string
}

/** Props for {@link InviteOverviewBase}. */
export interface InviteOverviewBaseProps {
    readonly shape: InviteOverviewShape
    readonly props: {
        /** What the invitation says and what the visitor can do with it. */
        readonly view: InviteOverviewView
        /** The invitation is still being read: its words draw as skeleton and its steps wait. */
        readonly isSkeleton: boolean
        readonly acceptLabel: string
        readonly switchLabel: string
        readonly isAccepting: boolean
        readonly isSwitching: boolean
    }
    readonly on: {
        readonly accept: () => void
        readonly switchAccount: () => void
    }
}

/** The step a visitor can take on a usable invitation. */
const Actions = (props: InviteOverviewBaseProps) => {
    const view = props.props.view
    if (props.shape === "signedOut") {
        return (
            <>
                <Text size="sm" tone="muted">
                    {view.signedOutHint}
                </Text>
                <Button intent="commit" width="fill" href={view.signInHref}>
                    {view.signInLabel}
                </Button>
                <Button intent="alternative" width="fill" href={view.signUpHref}>
                    {view.signUpLabel}
                </Button>
            </>
        )
    }
    if (props.shape === "mismatch") {
        return (
            <>
                <Text weight="semibold">{view.mismatchTitle}</Text>
                <Text size="sm" tone="muted">
                    {view.mismatchBody}
                </Text>
                <Button intent="neutral" isPending={props.props.isSwitching} onPress={props.on.switchAccount}>
                    {props.props.switchLabel}
                </Button>
            </>
        )
    }
    return (
        <>
            <Text size="sm" tone="muted">
                {view.signedInAs}
            </Text>
            <Button intent="commit" isPending={props.props.isAccepting} onPress={props.on.accept}>
                {props.props.acceptLabel}
            </Button>
        </>
    )
}

/** The words under the heading: what the invitation is for, and for whom. */
const Details = (props: InviteOverviewBaseProps) => (
    <>
        <Text size="sm" tone="muted">
            {props.props.view.forEmail}
        </Text>
        {props.props.view.asStaff === undefined ? null : (
            <Text size="sm" tone="muted">
                {props.props.view.asStaff}
            </Text>
        )}
        <Actions {...props} />
    </>
)

/** Draws the invitation: what it is for, and the right next step for a signed-out, mismatched or matching visitor. */
export const InviteOverviewBase = (props: InviteOverviewBaseProps) => {
    const view = props.props.view
    const isSkeleton = props.props.isSkeleton
    const isUsable = props.shape !== "unavailable"
    return (
        <SurfaceCard ariaLabel={view.title}>
            <div className={INVITE_STACK_CLASS_NAME}>
                <Heading level={1} isSkeleton={isSkeleton}>
                    {view.title}
                </Heading>
                <Text isSkeleton={isSkeleton} {...(isUsable ? {} : { tone: "muted" as const })}>
                    {view.body}
                </Text>
                {isSkeleton ? null : <InviteStep {...props} isUsable={isUsable} />}
            </div>
        </SurfaceCard>
    )
}

/** What the step under the words draws from. */
type InviteStepProps = InviteOverviewBaseProps & { readonly isUsable: boolean }

/** The step under the words: the way in for a link that cannot be used, or the visitor's own next step. */
const InviteStep = (props: InviteStepProps) =>
    props.isUsable ? (
        <Details {...props} />
    ) : (
        <Button intent="neutral" width="fill" href={props.props.view.loginHref}>
            {props.props.view.goSignInLabel}
        </Button>
    )
