import { Button, DescriptionList, Text, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AuthPanel } from "@/components/frames/AuthPanel"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The invitation shapes, in the order the owner approved them. */
export const INVITE_OVERVIEW_SHAPES = ["unavailable", "signedOut", "mismatch", "ready"] as const
/** One drawing per visitor: a link that cannot be used, a signed-out visitor, another account, or the matching one. */
export type InviteOverviewShape = (typeof INVITE_OVERVIEW_SHAPES)[number]

/** Everything the invitation card draws, in the visitor's words. */
export interface InviteOverviewView {
    /** What the visitor can do with the invitation: which of the four drawings reads. */
    readonly visitor: InviteOverviewShape
    readonly title: string
    readonly body: string
    readonly forEmail: string
    readonly forTerm: string
    readonly roleTerm: string
    readonly roleLabel: string
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
    readonly props: {
        /** What the invitation says and what the visitor can do with it, through the one status recipe. */
        readonly slot: DataSlot<InviteOverviewView>
        /** The card of the same shape, drawn as a skeleton while the invitation and the session are read. */
        readonly placeholder: InviteOverviewView
        readonly slotLabels: SlotLabels
        readonly acceptLabel: string
        readonly switchLabel: string
        readonly isAccepting: boolean
        readonly isSwitching: boolean
    }
    readonly on: {
        readonly accept: () => void
        readonly switchAccount: () => void
        readonly retry: () => void
    }
}

/** What one card draws: the invitation's words, whether they are still being read, and what the visitor can press. */
interface CardProps {
    readonly view: InviteOverviewView
    readonly isLoading: boolean
    readonly props: InviteOverviewBaseProps["props"]
    readonly on: InviteOverviewBaseProps["on"]
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
    <Button {...(props.intent === "commit" ? { endArrow: true } : {})} intent={props.intent} width="fill" href={props.href} isLoading={props.isLoading}>
        {props.label}
    </Button>
)

/** The step a visitor can take on a usable invitation. */
const Actions = (props: CardProps) => {
    const { view } = props
    if (view.visitor === "signedOut") {
        return (
            <>
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {view.signedOutHint}
                </Text>
                <SignLink
                    intent="commit"
                    href={view.signInHref}
                    label={view.signInLabel}
                    isLoading={props.isLoading}
                />
                <SignLink
                    intent="alternative"
                    href={view.signUpHref}
                    label={view.signUpLabel}
                    isLoading={props.isLoading}
                />
            </>
        )
    }
    if (view.visitor === "mismatch") {
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
                    isLoading={props.isLoading}
                >
                    {props.props.switchLabel}
                </Button>
            </>
        )
    }
    return (
        <>
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {view.signedInAs}
            </Text>
            <Button
                intent="commit"
                width="fill"
                isPending={props.props.isAccepting}
                onPress={props.on.accept}
                isLoading={props.isLoading}
            >
                {props.props.acceptLabel}
            </Button>
        </>
    )
}

/** The words under the heading: for whom the invitation is, and the step the visitor can take. */
const Details = (props: CardProps) => {
    const { view } = props
    const items = [
        { id: "role", term: view.roleTerm, description: view.roleLabel },
        { id: "for", term: view.forTerm, description: view.forEmail },
        ...(view.asStaff === undefined ? [] : [{ id: "staff", term: view.staffTerm, description: view.asStaff }]),
    ]
    return (
        <>
            <SurfaceCard><DescriptionList items={items} isLoading={props.isLoading} /></SurfaceCard>
            <Actions {...props} />
        </>
    )
}

/** The invitation card of one read: what it is for, and the right next step for a signed-out, mismatched or matching visitor. */
const Card = (props: CardProps) => {
    const { view } = props
    return (
        <AuthPanel label={view.title} title={view.title} text={view.body} level={1} isLoading={props.isLoading}>
            {view.visitor === "unavailable" ? (
                <Button endArrow intent="commit" width="fill" href={view.loginHref}>
                    {view.goSignInLabel}
                </Button>
            ) : (
                <Details {...props} />
            )}
        </AuthPanel>
    )
}

/** Draws the invitation through the one status recipe: the card of the read, its skeleton from the same card, a failure with its retry. */
export const InviteOverviewBase = (props: InviteOverviewBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view, isLoading) => <Card view={view} isLoading={isLoading} props={props.props} on={props.on} />}
    />
)
