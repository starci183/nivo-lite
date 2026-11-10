import { Avatar, Button, Cluster, Form, Input, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { FormNotice } from "@/components/composites/FormNotice"

/** The invitation a pasted link names, worded for this visitor: join here, or open its page to sign in or switch account. */
export interface WorkspaceJoinPreview {
    readonly workspaceName: string
    /** Which workspace invites the visitor, and in which role. */
    readonly line: string
    /** The account the invitation is for, against the one in use. */
    readonly note: string
    readonly actionLabel: string
    /** `join` accepts in place; `open` leads to the invitation page (signed out, or another account). */
    readonly action: "join" | "open"
    readonly openHref: string
    readonly isAccepting: boolean
}

/** Copy and state the connected join form supplies. */
export interface WorkspaceJoinBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly linkLabel: string
        readonly placeholder: string
        readonly failTitle: string
        readonly value: string
        /** Why the pasted text cannot be used (not a link, expired, revoked); drawn under the field. */
        readonly error?: string | undefined
        /** The invitation, once the pasted link reads as a usable one. */
        readonly preview?: WorkspaceJoinPreview | undefined
        readonly isReading: boolean
    }
    readonly on: {
        readonly setValue: (value: string) => void
        readonly accept: () => void
    }
}

/** The preview zone: the workspace, the line, the account note, and the one way on. */
const previewZone = (preview: WorkspaceJoinPreview, accept: () => void) => ({
    kind: "custom" as const,
    children: (
        <Stack gap="row">
            <Cluster gap="row" wrap={false}>
                <Avatar name={preview.workspaceName} size="md" />
                <Stack gap="identity">
                    <Text isStrong>{preview.workspaceName}</Text>
                    <Text size="sm" tone="muted">
                        {preview.line}
                    </Text>
                </Stack>
            </Cluster>
            <Text size="sm" tone="muted">
                {preview.note}
            </Text>
            {preview.action === "join" ? (
                <Button intent="commit" width="fill" isPending={preview.isAccepting} onPress={accept}>
                    {preview.actionLabel}
                </Button>
            ) : (
                <Button endArrow intent="neutral" width="fill" href={preview.openHref}>
                    {preview.actionLabel}
                </Button>
            )}
        </Stack>
    ),
})

/**
 * Draws "join by link": paste an invitation link and the workspace it names shows right under it, with joining in place when the
 * link is for the account in use. No submit step: the field reads the link as it is pasted.
 */
export const WorkspaceJoinBase = (props: WorkspaceJoinBaseProps) => (
    <SurfaceCard
        label={props.props.title}
        headingLevel={2}
        note={props.props.description}
        {...(props.props.preview === undefined ? {} : { footers: [previewZone(props.props.preview, props.on.accept)] })}
    >
        <Form label={props.props.linkLabel} onSubmit={props.on.accept}>
            <Stack gap="row">
                <Input
                    id="ws-link"
                    name="link"
                    label={props.props.linkLabel}
                    placeholder={props.props.placeholder}
                    value={props.props.value}
                    onValueChange={props.on.setValue}
                    isLoading={props.props.isReading}
                />
                <FormNotice failTitle={props.props.failTitle} error={props.props.error} />
            </Stack>
        </Form>
    </SurfaceCard>
)
