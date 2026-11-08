import { Avatar, Grid, PageIntro, Page } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"

import { PublicBookingForm, type PublicBookingFormProps } from "@/components/composites/PublicBookingForm"
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
    <PageIntro
        title={props.page.shop}
        isLoading={props.isLoading}
        mark={<Avatar name={props.page.shop} tone="accent" size="lg" isLoading={props.isLoading} />}
        lines={[props.page.address, props.page.note].filter((text) => text !== "").map((text) => ({ id: text, text }))}
        description={props.intro}
    />
)

/** Draws the public booking page: the shop beside one card that books. */
export const PublicBookingContentBase = (props: PublicBookingContentBaseProps) => {
    const { slot, copy, form } = props.props
    return (
        <Page chrome="bleed" minHeight="none">
            <PublicShell
                label={copy.title}
                foot={copy.foot}
                measure="narrow"
                brand={{
                    name: "items" in slot ? slot.items.shop : null,
                    isLoading: "isLoading" in slot,
                    fallbackLabel: copy.brandFallback,
                }}
                language={props.props.language}
                onChooseLanguage={props.on.chooseLanguage}
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
                            railWidth="medium"
                            align="start"
                            rail={<ShopIdentity page={page} isLoading={isLoading} intro={copy.intro} />}
                            primary={
                                <PublicBookingForm key={page.slug} props={form} on={props.on} isLoading={isLoading} />
                            }
                        />
                    )}
                />
            </PublicShell>
        </Page>
    )
}
