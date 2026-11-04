import { Avatar, Cluster, Grid, Heading, Stack, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"

import { NivoLogo } from "@/components/leaves/NivoLogo"
import { LanguageMenu } from "@/components/composites/LanguageMenu"
import { PublicBrand } from "@/components/composites/PublicBrand"
import { PublicBookingForm } from "@/components/composites/PublicBookingForm"
import type { PublicBookingFormProps } from "@/components/composites/PublicBookingForm"
import { PublicShell } from "@/components/frames/PublicShell"
import type { DataSlot, PublicBookingPageData, SlotLabels } from "@/modules/types"

/** Props for {@link PublicBookingContentBase}. */
interface PublicBookingContentView {
    readonly form: PublicBookingFormProps["props"]
    readonly slot: DataSlot<PublicBookingPageData>
    readonly labels: SlotLabels
    /** The language menu at the end of the bar. */
    readonly language: {
        readonly label: string
        readonly locale: string
        readonly isPending: boolean
        readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
    }
    readonly copy: {
        readonly title: string
        readonly brandFallback: string
        readonly foot: string
        readonly intro: string
        readonly notFoundBody: string
        readonly failedBody: string
    }
}

/** Inputs for the public booking page and its read states. */
interface PublicBookingContentBaseProps {
    readonly props: PublicBookingContentView
    readonly on: PublicBookingFormProps["on"] & {
        readonly retry: () => void
        readonly chooseLanguage: (locale: string) => void
    }
}

/** Unseen text that gives a skeleton line the width of a real one. */
const GHOST = "M".repeat(16)

/** The shop of the skeleton: the ready tree's own text stays empty so nothing jumps when the shop arrives. */
const SHOP_PLACEHOLDER: PublicBookingPageData = {
    shop: GHOST,
    slug: "",
    note: GHOST,
    address: GHOST,
    timezone: "UTC",
    services: ["a", "b", "c"].map((id) => ({ id, name: GHOST, description: GHOST, durationMin: 0, priceVnd: null })),
}

/** What the shop identity draws. */
interface ShopIdentityProps {
    readonly page: PublicBookingPageData
    readonly isLoading: boolean
    readonly intro: string
}

/** The shop the visitor books with: its mark, its name as the page's one heading, where it is and when it is open. */
const ShopIdentity = (props: ShopIdentityProps) => (
    <Stack gap="section">
        <Cluster gap="row" align="center">
            <Avatar name={props.page.shop} shape="rounded" size="lg" isLoading={props.isLoading} />
            <Stack gap="identity">
                <Heading level={1} isLoading={props.isLoading}>
                    {props.page.shop}
                </Heading>
                {props.page.address === "" ? null : (
                    <Text size="sm" tone="muted" overflow="wrap" isLoading={props.isLoading}>
                        {props.page.address}
                    </Text>
                )}
                {props.page.note === "" ? null : (
                    <Text size="xs" tone="muted" isLoading={props.isLoading}>
                        {props.page.note}
                    </Text>
                )}
            </Stack>
        </Cluster>
        <Text size="sm" tone="muted" isLoading={props.isLoading}>
            {props.intro}
        </Text>
    </Stack>
)

/** What the bar's brand draws. */
interface ShopBrandProps {
    readonly slot: DataSlot<PublicBookingPageData>
    readonly fallback: string
}

/** The shop in the bar once it is known, its geometry while it loads, the platform's own mark when there is no shop to show. */
const ShopBrand = (props: ShopBrandProps) => {
    const { slot } = props
    if ("items" in slot) return <PublicBrand name={slot.items.shop} />
    if ("isLoading" in slot) return <PublicBrand name={GHOST} isLoading />
    return <NivoLogo label={props.fallback} />
}

/** Draws the public booking page: the shop beside one card that books. */
export const PublicBookingContentBase = (props: PublicBookingContentBaseProps) => {
    const { slot, copy, form } = props.props
    return (
        <PublicShell
            label={copy.title}
            actions={
                <LanguageMenu
                    label={props.props.language.label}
                    value={props.props.language.locale}
                    options={props.props.language.options}
                    isDisabled={props.props.language.isPending}
                    onChange={props.on.chooseLanguage}
                />
            }
            foot={copy.foot}
            measure="product"
            brand={<ShopBrand slot={slot} fallback={copy.brandFallback} />}
        >
            <SlotView
                slot={slot}
                placeholder={SHOP_PLACEHOLDER}
                labels={props.props.labels}
                errorDescription={copy.failedBody}
                emptyDescription={copy.notFoundBody}
                onRetry={props.on.retry}
                render={(page, isLoading) => (
                    <Grid
                        kind="main-rail"
                        railPosition="leading"
                        collapsedOrder="rail-first"
                        railWidth="wide"
                        align="start"
                        rail={<ShopIdentity page={page} isLoading={isLoading} intro={copy.intro} />}
                        primary={<PublicBookingForm key={page.slug} props={form} on={props.on} isLoading={isLoading} />}
                    />
                )}
            />
        </PublicShell>
    )
}
