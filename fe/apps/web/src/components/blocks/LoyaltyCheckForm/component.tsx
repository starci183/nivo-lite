import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    EmptyNotice,
    Form,
    Heading,
    Input,
    ListRow,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { CARD_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** The drawn shapes of the public points check, in the order the visitor meets them. */
export const LOYALTY_CHECK_SHAPES = ["phone", "code", "result"] as const
/** One drawing per step of the points check. */
export type LoyaltyCheckShape = (typeof LOYALTY_CHECK_SHAPES)[number]

/** What the shop page tells the check: the lead line under the title. */
export interface LoyaltyCheckShop {
    readonly lead: string
}

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const SHOP_PLACEHOLDER: LoyaltyCheckShop = { lead: "" }

/** One reward the shop lists. */
export interface LoyaltyCheckReward {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly badge: string
    readonly canRedeem: boolean
}

/** What the visitor sees once the code is right. */
export interface LoyaltyCheckResult {
    readonly greeting: string
    readonly tierLabel: string
    readonly tierName: string
    readonly pointsLabel: string
    readonly points: string
    readonly nextTier?: string
    readonly expiring?: string
    readonly rewardsTitle: string
    readonly noRewards: string
    readonly redeemHint: string
    readonly rewards: ReadonlyArray<LoyaltyCheckReward>
}

/** Props for {@link LoyaltyCheckFormBase}. */
export interface LoyaltyCheckFormBaseProps {
    readonly shape: LoyaltyCheckShape
    readonly props: {
        readonly slot: DataSlot<LoyaltyCheckShop>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly phone: {
            readonly label: string
            readonly placeholder: string
            readonly value: string
            readonly send: string
        }
        readonly code: {
            readonly label: string
            readonly value: string
            readonly check: string
            readonly sentTitle: string
            readonly sentBody: string
            readonly resend: string
        }
        readonly back: string
        readonly error?: string
        readonly isBusy: boolean
        readonly result?: LoyaltyCheckResult
    }
    readonly on: {
        readonly setPhone: (value: string) => void
        readonly setCode: (value: string) => void
        readonly sendCode: () => void
        readonly check: () => void
        readonly back: () => void
        readonly retry: () => void
    }
}

/** Props of the drawn tree once the shop is known (or its placeholder). */
interface CheckBodyProps extends LoyaltyCheckFormBaseProps {
    readonly lead: string
    readonly isSkeleton: boolean
}

const CheckPhone = (props: CheckBodyProps) => {
    const { title, isBusy } = props.props
    const on = props.on
    return (
        <>
            <Text tone="muted" isSkeleton={props.isSkeleton}>
                {props.lead}
            </Text>
            <Form label={title} onSubmit={on.sendCode} isPending={isBusy}>
                <div className={FORM_CLASS_NAME}>
                    <Input
                        id="loyalty-phone"
                        name="phone"
                        label={props.props.phone.label}
                        placeholder={props.props.phone.placeholder}
                        isRequired
                        isDisabled={isBusy}
                        isSkeleton={props.isSkeleton}
                        value={props.props.phone.value}
                        onValueChange={on.setPhone}
                    />
                    <Button intent="commit" width="fill" type="submit" isPending={isBusy} isSkeleton={props.isSkeleton}>
                        {props.props.phone.send}
                    </Button>
                </div>
            </Form>
        </>
    )
}

/** Draws the step the visitor is on: the phone number, the code, or the points once the code is right. */
const CheckStep = (props: CheckBodyProps) => {
    const { title, error } = props.props
    if (props.shape === "result") return renderGreeting(props)
    return (
        <SurfaceCard ariaLabel={title}>
            <div className={CARD_CLASS_NAME}>
                <Heading level={1} scale="standard" isSkeleton={props.isSkeleton}>
                    {title}
                </Heading>
                {props.shape === "phone" ? <CheckPhone {...props} /> : renderVerificationCode(props)}
                {error === undefined ? null : <Alert tone="negative" title={error} />}
            </div>
        </SurfaceCard>
    )
}

/** Draws the public points check: phone, then the code sent to the customer's own chat, then their points. Shows nothing about a number before the code is right. */
export const LoyaltyCheckFormBase = (props: LoyaltyCheckFormBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={SHOP_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(shop, isSkeleton) => <CheckStep {...props} shape={props.shape} lead={shop.lead} isSkeleton={isSkeleton} />}
    </SlotView>
)

/** Draws the greeting section of the current view. */
const renderGreeting = (props: Pick<LoyaltyCheckFormBaseProps, "props" | "on">) => {
    const { result } = props.props
    const on = props.on
    if (result === undefined) return null
    return (
        <SurfaceCard ariaLabel={result.greeting}>
            <div className={CARD_CLASS_NAME}>
                <Heading level={2} scale="standard">
                    {result.greeting}
                </Heading>
                <DescriptionList
                    layout="stat-strip"
                    isDivided
                    items={[
                        { id: "tier", term: result.tierLabel, description: result.tierName },
                        { id: "points", term: result.pointsLabel, description: result.points },
                    ]}
                />
                {result.nextTier === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {result.nextTier}
                    </Text>
                )}
                {result.expiring === undefined ? null : <Alert tone="affirmative" title={result.expiring} />}
                <SurfaceListCard
                    label={result.rewardsTitle}
                    headingLevel={3}
                    empty={<EmptyNotice message={result.noRewards} />}
                >
                    {result.rewards.map((reward) => (
                        <ListRow
                            key={reward.id}
                            title={reward.name}
                            description={reward.detail}
                            badges={<Badge tone={reward.canRedeem ? "success" : "neutral"}>{reward.badge}</Badge>}
                        />
                    ))}
                </SurfaceListCard>
                <Text size="sm" tone="muted">
                    {result.redeemHint}
                </Text>
                <Button intent="neutral" onPress={on.back}>
                    {props.props.back}
                </Button>
            </div>
        </SurfaceCard>
    )
}

/** Draws the LoyaltyCheckFormContent section of the current view. */
const renderVerificationCode = (props: Pick<LoyaltyCheckFormBaseProps, "props" | "on">) => {
    const { isBusy } = props.props
    const on = props.on
    return (
        <>
            <Alert tone="affirmative" title={props.props.code.sentTitle} description={props.props.code.sentBody} />
            <Form label={props.props.code.check} onSubmit={on.check} isPending={isBusy}>
                <div className={FORM_CLASS_NAME}>
                    <Input
                        id="loyalty-code"
                        name="code"
                        kind="code"
                        label={props.props.code.label}
                        isRequired
                        isDisabled={isBusy}
                        value={props.props.code.value}
                        onValueChange={on.setCode}
                    />
                    <Button intent="commit" width="fill" type="submit" isPending={isBusy}>
                        {props.props.code.check}
                    </Button>
                </div>
            </Form>
            <Button intent="neutral" isDisabled={isBusy} onPress={on.sendCode}>
                {props.props.code.resend}
            </Button>
            <Button intent="dismiss" isDisabled={isBusy} onPress={on.back}>
                {props.props.back}
            </Button>
        </>
    )
}
