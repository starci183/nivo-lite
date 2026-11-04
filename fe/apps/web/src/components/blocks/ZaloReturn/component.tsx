import { Heading, Page, Progress, Text } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { BAR_CLASS_NAME, WAIT_CLASS_NAME } from "./classNames"

/** The text and the hand-over the connected block supplies. */
export interface ZaloReturnBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        /** The provider's own mark. */
        readonly markSrc: string
        readonly heading: string
        readonly waiting: string
        readonly progressLabel: string
        readonly errorDescription: string
        /** The address the browser lands on once the back end took the return. */
        readonly landing: DataSlot<string>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/**
 * Draws the Zalo return: the console band and trail stay for a way back, the middle of the page says what is happening with a progress
 * bar, and a failure says it in one sentence with the retry in place.
 */
export const ZaloReturnBase = (props: ZaloReturnBaseProps) => (
    <Page
        measure="reading"
        header={{
            breadcrumbs: { label: props.props.crumbLabel, items: [...props.props.crumbs] },
            title: props.props.title,
        }}
    >
        <div className={WAIT_CLASS_NAME}>
            <SlotView
                slot={props.props.landing}
                placeholder=""
                labels={props.props.slotLabels}
                errorDescription={props.props.errorDescription}
                onRetry={props.on.retry}
                render={() => (
                    <>
                        <ProviderLogo glyph="chat" src={props.props.markSrc} size="lg" />
                        <Heading level={2}>{props.props.heading}</Heading>
                        <output>
                            <Text as="span" tone="muted">
                                {props.props.waiting}
                            </Text>
                        </output>
                        <div className={BAR_CLASS_NAME}>
                            <Progress label={props.props.progressLabel} value={40} />
                        </div>
                    </>
                )}
            />
        </div>
    </Page>
)
