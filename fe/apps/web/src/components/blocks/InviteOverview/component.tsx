import { Button, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import type { InviteView } from "@/hooks/invite"
import { INVITE_STACK_CLASS_NAME } from "./classNames"

/** Props for {@link InviteOverviewBase}. */
export interface InviteOverviewBaseProps {
    readonly props: {
        /** What the invitation says and what the visitor can do with it. */
        readonly view: InviteView
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
    if (view.state === "signedOut") {
        return (
            <>
                <Text size="sm" tone="muted">
                    {view.signedOutHint}
                </Text>
                <Button variant="primary" width="fill" href={view.signInHref}>
                    {view.signInLabel}
                </Button>
                <Button variant="secondary" width="fill" href={view.signUpHref}>
                    {view.signUpLabel}
                </Button>
            </>
        )
    }
    if (view.state === "mismatch") {
        return (
            <>
                <Text weight="semibold">{view.mismatchTitle}</Text>
                <Text size="sm" tone="muted">
                    {view.mismatchBody}
                </Text>
                <Button variant="secondary" isPending={props.props.isSwitching} onPress={props.on.switchAccount}>
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
            <Button variant="primary" isPending={props.props.isAccepting} onPress={props.on.accept}>
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
    if (view.state === "loading") {
        return (
            <SurfaceCard ariaLabel={view.title}>
                <div className={INVITE_STACK_CLASS_NAME}>
                    <Heading level={1} isSkeleton>
                        {view.title}
                    </Heading>
                    <Text isSkeleton>{view.title}</Text>
                </div>
            </SurfaceCard>
        )
    }
    const isUsable = view.state !== "unavailable"
    return (
        <SurfaceCard ariaLabel={view.title}>
            <div className={INVITE_STACK_CLASS_NAME}>
                <Heading level={1}>{view.title}</Heading>
                <Text tone={isUsable ? undefined : "muted"}>{view.body}</Text>
                {isUsable ? (
                    <Details {...props} />
                ) : (
                    <Button variant="secondary" width="fill" href={view.loginHref}>
                        {view.goSignInLabel}
                    </Button>
                )}
            </div>
        </SurfaceCard>
    )
}
