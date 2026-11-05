import { Alert, Button, Cluster, Form, Input, Stack, SurfaceCard } from "@starci/grammar/common"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Copy, values and state the connected profile card supplies. */
export interface AccountProfileBaseProps {
    readonly props: {
        readonly title: string
        /** The person's id: the generated avatar when there is no picture. */
        readonly seed: string | undefined
        /** The live preview: the chosen picture while it uploads, else the saved one, else none. */
        readonly picture: string | null
        readonly avatar: {
            readonly label: string
            readonly pickLabel: string
            readonly hint: string
            readonly accept: string
            readonly error?: string | undefined
            readonly removeLabel: string
            readonly canRemove: boolean
            readonly isBusy: boolean
        }
        readonly nameLabel: string
        readonly nameHint: string
        readonly saveLabel: string
        readonly failTitle: string
        readonly name: string
        readonly isPending: boolean
        /** The account read: the card draws once it arrived. */
        readonly slot: DataSlot<true>
        readonly labels: SlotLabels
        readonly error?: string | undefined
        readonly done?: string
    }
    readonly on: {
        readonly pick: (files: Array<File>) => void
        readonly remove: () => void
        readonly setName: (value: string) => void
        readonly submit: () => void
        readonly retry: () => void
    }
}

/** What a band of the card draws: the card's props and whether the account read is still waiting. */
type BandProps = AccountProfileBaseProps & { readonly isSkeleton: boolean }

/** The first band: the picture with its preview while the read waits as geometry. */
const PictureBand = (props: BandProps) => (
    <AvatarEditor
        preview={
            <PersonAvatar
                name={props.isSkeleton ? "" : props.props.name}
                seed={props.isSkeleton ? undefined : props.props.seed}
                src={props.isSkeleton ? null : props.props.picture}
                size="lg"
                isLoading={props.isSkeleton}
            />
        }
        {...props.props.avatar}
        isLoading={props.isSkeleton}
        onPick={props.on.pick}
        onRemove={props.on.remove}
    />
)

/** The second band: the display name, the failure or done note and the one save command at the end. */
const NameBand = (props: BandProps) => (
    <Form label={props.props.title} onSubmit={props.on.submit} isPending={props.props.isPending}>
        <Stack gap="section">
            <Input
                id="account-name"
                name="name"
                label={props.props.nameLabel}
                description={props.props.nameHint}
                isRequired
                isDisabled={props.props.isPending}
                isLoading={props.isSkeleton}
                value={props.isSkeleton ? "" : props.props.name}
                onValueChange={props.on.setName}
            />
            {props.props.error === undefined ? null : (
                <Alert tone="negative" title={props.props.failTitle} description={props.props.error} />
            )}
            {props.props.done === undefined ? null : <Alert tone="affirmative" title={props.props.done} />}
            <Cluster gap="row" justify="end">
                <Button type="submit" intent="commit" isPending={props.props.isPending} isLoading={props.isSkeleton}>
                    {props.props.saveLabel}
                </Button>
            </Cluster>
        </Stack>
    </Form>
)

/**
 * Draws the profile as one card of two bands under its label: the picture with its live preview, then the display name with
 * the one save command at the end. Every part of the card is geometry together while the account loads.
 */
export const AccountProfileBase = (props: AccountProfileBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder
        labels={props.props.labels}
        onRetry={props.on.retry}
        render={(_, isSkeleton) => (
            <SurfaceCard
                kind="bands"
                label={props.props.title}
                headingLevel={2}
                isLoading={isSkeleton}
                bands={[
                    { kind: "body", children: <PictureBand {...props} isSkeleton={isSkeleton} /> },
                    { kind: "body", children: <NameBand {...props} isSkeleton={isSkeleton} /> },
                ]}
            />
        )}
    />
)
