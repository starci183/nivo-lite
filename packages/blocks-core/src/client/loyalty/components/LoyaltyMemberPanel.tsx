import type { ReactNode } from "react"
import type { LoyaltyViews, LoyaltyActions } from "../types"
import { Badge, Button, DescriptionList, SurfaceCard, Text, Stack, Cluster } from "@starci/grammar/common"

import { LoyaltyLedger } from "./LoyaltyLedger"

import { LoyaltyMemberAdjustForm } from "./LoyaltyMemberAdjustForm"

import { LoyaltyMemberEditForm } from "./LoyaltyMemberEditForm"

import { LoyaltyRewardOptions } from "./LoyaltyRewardOptions"

type EditActions = LoyaltyActions["memberEdit"]
type AdjustActions = LoyaltyActions["memberAdjust"]

/** A member's ready atoms; form and redemption callbacks have a separate action carrier. */
type LoyaltyMemberPanelView = LoyaltyViews["member"]

/** The ready member panel, its actual loading geometry and its separately resolved actions. */
interface LoyaltyMemberPanelProps extends LoyaltyMemberPanelView {
    readonly isLoading: boolean
    readonly onClose: () => void
    readonly onEdit: EditActions
    readonly onAdjust: AdjustActions
    readonly onRedeem: (id: string) => void
}

type IdentityProps = Pick<
    LoyaltyMemberPanelProps,
    | "name"
    | "closeLabel"
    | "tier"
    | "points"
    | "contact"
    | "spentLine"
    | "joinedLine"
    | "nextTierLine"
    | "expiringLine"
    | "isLoading"
    | "onClose"
>

/** The member's identity and balance retain their original card and reading order. */
const Identity = (props: IdentityProps) => (
    <SurfaceCard
        label={props.name}
        headingLevel={2}
        isLoading={props.isLoading}
        labelEnd={
            <Button intent="neutral" size="sm" onPress={props.onClose} isLoading={props.isLoading}>
                {props.closeLabel}
            </Button>
        }
    >
        <Stack gap="row">
            <Cluster gap="inline">
                {props.tier === undefined ? null : (
                    <Badge tone={props.tier.tone} isLoading={props.isLoading}>
                        {props.tier.name}
                    </Badge>
                )}
                <Text as="span" size="md" isStrong isLoading={props.isLoading}>
                    {props.points}
                </Text>
            </Cluster>
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.contact}
            </Text>
            <Text size="sm" isLoading={props.isLoading}>
                {props.spentLine}
            </Text>
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.joinedLine}
            </Text>
            <Text size="sm" isLoading={props.isLoading}>
                {props.nextTierLine}
            </Text>
            {props.expiringLine === undefined ? null : (
                <Text size="sm" isStrong isLoading={props.isLoading}>
                    {props.expiringLine}
                </Text>
            )}
        </Stack>
    </SurfaceCard>
)

type MemberFormsProps = Pick<
    LoyaltyMemberPanelProps,
    "editTitle" | "edit" | "readOnly" | "adjustTitle" | "adjustBody" | "adjust" | "isLoading" | "onEdit" | "onAdjust"
>

/** The manager edit form or staff facts, followed by the unchanged points adjustment task. */
const MemberForms = (props: MemberFormsProps) => (
    <>
        <SurfaceCard label={props.editTitle} headingLevel={3} isLoading={props.isLoading}>
            <Stack gap="row">
                {props.edit === undefined ? null : (
                    <LoyaltyMemberEditForm {...props.edit} {...props.onEdit} isLoading={props.isLoading} />
                )}
                {props.readOnly === undefined ? null : (
                    <>
                        <DescriptionList
                            layout="columns"
                            items={[...props.readOnly.items]}
                            isLoading={props.isLoading}
                        />
                        <Text size="xs" tone="muted" isLoading={props.isLoading}>
                            {props.readOnly.note}
                        </Text>
                    </>
                )}
            </Stack>
        </SurfaceCard>
        <SurfaceCard label={props.adjustTitle} headingLevel={3} isLoading={props.isLoading}>
            <Stack gap="row">
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {props.adjustBody}
                </Text>
                <LoyaltyMemberAdjustForm {...props.adjust} {...props.onAdjust} isLoading={props.isLoading} />
            </Stack>
        </SurfaceCard>
    </>
)

/** Ready and pending member geometry is drawn once; read statuses and retries stay with the connected owner. */
export const LoyaltyMemberPanel = (props: LoyaltyMemberPanelProps): ReactNode => {
    const {
        edit,
        readOnly,
        adjust,
        rewards,
        ledger,
        editTitle,
        adjustTitle,
        adjustBody,
        asOf,
        onEdit,
        onAdjust,
        onRedeem,
        ...identity
    } = props
    return (
        <Stack gap="row">
            <Identity {...identity} />
            <MemberForms
                editTitle={editTitle}
                {...(edit === undefined ? {} : { edit })}
                {...(readOnly === undefined ? {} : { readOnly })}
                adjustTitle={adjustTitle}
                adjustBody={adjustBody}
                adjust={adjust}
                isLoading={props.isLoading}
                onEdit={onEdit}
                onAdjust={onAdjust}
            />
            <LoyaltyRewardOptions {...rewards} onRedeem={onRedeem} isLoading={props.isLoading} />
            <LoyaltyLedger {...ledger} isLoading={props.isLoading} />
            <Text size="xs" tone="muted" isLoading={props.isLoading}>
                {asOf}
            </Text>
        </Stack>
    )
}
