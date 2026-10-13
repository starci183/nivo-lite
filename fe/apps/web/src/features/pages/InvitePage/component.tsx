import { Button, Heading, PageContainer, SurfaceCard, Text, WorkspaceShell } from "@starci/grammar/common"
import { AcceptInvite } from "@/components/blocks/AcceptInvite"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { SwitchAccount } from "@/components/blocks/SwitchAccount"
import { INVITE_COLUMN_CLASS_NAME, INVITE_STACK_CLASS_NAME } from "./classNames"

/** Props for {@link InvitePageBase}. */
export interface InvitePageBaseProps {
    /** unavailable: the link is invalid, expired, revoked or used; signedOut, mismatch and ready follow the visitor. */
    readonly state: "unavailable" | "signedOut" | "mismatch" | "ready"
    readonly props: {
        readonly token: string
        readonly next: string
        readonly title: string
        readonly body: string
        readonly goSignInLabel: string
        readonly forEmail: string
        readonly asStaff?: string
        readonly signedOutHint: string
        readonly signInLabel: string
        readonly signUpLabel: string
        readonly loginHref: string
        readonly signInHref: string
        readonly signUpHref: string
        readonly mismatchTitle: string
        readonly mismatchBody: string
        readonly signedInAs: string
    }
}

/** The step a visitor can take on a usable invitation. */
const Actions = (props: InvitePageBaseProps) => {
    const view = props.props
    if (props.state === "signedOut") {
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
    if (props.state === "mismatch") {
        return (
            <>
                <Text weight="semibold">{view.mismatchTitle}</Text>
                <Text size="sm" tone="muted">
                    {view.mismatchBody}
                </Text>
                <SwitchAccount next={view.next} />
            </>
        )
    }
    return (
        <>
            <Text size="sm" tone="muted">
                {view.signedInAs}
            </Text>
            <AcceptInvite token={view.token} />
        </>
    )
}

/** Draws the invitation: what it is for, and the right next step for a signed-out, mismatched or matching visitor. */
export const InvitePageBase = (props: InvitePageBaseProps) => {
    const view = props.props
    const usable = props.state !== "unavailable"
    return (
        <WorkspaceShell
            align="stretch"
            primaryLabel={view.title}
            primary={
                <PageContainer measure="reading">
                    <div className={INVITE_COLUMN_CLASS_NAME}>
                        <BrandLogo variant="full" height={40} />
                        <SurfaceCard ariaLabel={view.title}>
                            <div className={INVITE_STACK_CLASS_NAME}>
                                <Heading level={1}>{view.title}</Heading>
                                <Text tone={usable ? undefined : "muted"}>{view.body}</Text>
                                {usable ? (
                                    <>
                                        <Text size="sm" tone="muted">
                                            {view.forEmail}
                                        </Text>
                                        {view.asStaff === undefined ? null : (
                                            <Text size="sm" tone="muted">
                                                {view.asStaff}
                                            </Text>
                                        )}
                                        <Actions {...props} />
                                    </>
                                ) : (
                                    <Button variant="secondary" width="fill" href={view.loginHref}>
                                        {view.goSignInLabel}
                                    </Button>
                                )}
                            </div>
                        </SurfaceCard>
                    </div>
                </PageContainer>
            }
        />
    )
}
