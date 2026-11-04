import { Button, DescriptionList, Text } from "@starci/grammar/common"
import { AuthPanel } from "@/components/frames/AuthPanel"

/** The invitation shapes, in the order the owner approved them. */
export const INVITE_OVERVIEW_SHAPES = ["unavailable", "signedOut", "mismatch", "ready"] as const
/** One drawing per visitor: a link that cannot be used, a signed-out visitor, another account, or the matching one. */
export type InviteOverviewShape = (typeof INVITE_OVERVIEW_SHAPES)[number]

/** Everything the invitation card draws, in the visitor's words. */
export interface InviteOverviewView {
    readonly title: string
    readonly body: string
    readonly forEmail: string
    readonly forTerm: string
    readonly staffTerm: string
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
        readonly isLoading: boolean
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

/** What one sign-in or sign-up link of the invitation says and where it goes. */
interface SignLinkProps {
    readonly intent: "commit" | "alternative"
    readonly href: string
    readonly label: string
    readonly isLoading: boolean
}

/** One full-width link of the signed-out visitor to the sign-in or the sign-up page. */
const SignLink = (props: SignLinkProps) => (
    <Button intent={props.intent} width="fill" href={props.href} isLoading={props.isLoading}>
        {props.label}
    </Button>
)

/** The step a visitor can take on a usable invitation. */
const Actions = (props: InviteOverviewBaseProps) => {
    const view = props.props.view
    if (props.shape === "signedOut") {
        return (
            <>
                <Text size="sm" tone="muted">
                    {view.signedOutHint}
                </Text>
                <SignLink
                    intent="commit"
                    href={view.signInHref}
                    label={view.signInLabel}
                    isLoading={props.props.isLoading}
                />
                <SignLink
                    intent="alternative"
                    href={view.signUpHref}
                    label={view.signUpLabel}
                    isLoading={props.props.isLoading}
                />
            </>
        )
    }
    if (props.shape === "mismatch") {
        return (
            <>
                <Text isStrong>{view.mismatchTitle}</Text>
                <Text size="sm" tone="muted">
                    {view.mismatchBody}
                </Text>
                <Button
                    intent="commit"
                    width="fill"
                    isPending={props.props.isSwitching}
                    onPress={props.on.switchAccount}
                    isLoading={props.props.isLoading}
                >
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
            <Button
                intent="commit"
                width="fill"
                isPending={props.props.isAccepting}
                onPress={props.on.accept}
                isLoading={props.props.isLoading}
            >
                {props.props.acceptLabel}
            </Button>
        </>
    )
}

/** The words under the heading: for whom the invitation is, and the step the visitor can take. */
const Details = (props: InviteOverviewBaseProps) => {
    const view = props.props.view
    const items = [
        { id: "for", term: view.forTerm, description: view.forEmail },
        ...(view.asStaff === undefined ? [] : [{ id: "staff", term: view.staffTerm, description: view.asStaff }]),
    ]
    return (
        <>
            <DescriptionList items={items} isLoading={props.props.isLoading} />
            <Actions {...props} />
        </>
    )
}

/** Draws the invitation: what it is for, and the right next step for a signed-out, mismatched or matching visitor. */
export const InviteOverviewBase = (props: InviteOverviewBaseProps) => {
    const view = props.props.view
    const isUsable = props.shape !== "unavailable"
    return (
        <AuthPanel label={view.title} title={view.title} text={view.body} level={1} isLoading={props.props.isLoading}>
            {isUsable ? (
                <Details {...props} />
            ) : (
                <Button intent="commit" width="fill" href={view.loginHref}>
                    {view.goSignInLabel}
                </Button>
            )}
        </AuthPanel>
    )
}
