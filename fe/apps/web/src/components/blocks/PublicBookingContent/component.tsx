import { Stack, Alert, Button, Heading, Page, SurfaceCard, Text, WorkspaceShell } from "@starci/grammar/common"

import { PublicBookingForm } from "@/components/composites/PublicBookingForm"
import type { PublicBookingFormProps } from "@/components/composites/PublicBookingForm"
import { APP_ROUTES } from "@/modules/routes"
import type { PublicBookingPageData } from "@/modules/types"
import { MAIN_CLASS_NAME } from "./classNames"

/** Props for {@link PublicBookingContentBase}. */
interface PublicBookingContentView {
    readonly form: PublicBookingFormProps["props"]
    readonly title: string
    readonly page: PublicBookingPageData | null | undefined
    readonly failed: boolean
    readonly loadingLabel: string
    readonly failedTitle: string
    readonly failedBody: string
    readonly notFoundTitle: string
    readonly notFoundText: string
    readonly homeLabel: string
}

/** Inputs for the public booking page and its read states. */
interface PublicBookingContentBaseProps {
    readonly props: PublicBookingContentView
    readonly on: PublicBookingFormProps["on"]
}

/** Draws the public booking page: the shop, then the form. */
export const PublicBookingContentBase = (props: PublicBookingContentBaseProps) => {
    const { title, page } = props.props
    if (page === null) {
        return (
            <Page measure="reading" header={{ title: props.props.notFoundTitle }}>
                <SurfaceCard>
                    <Text tone="muted">{props.props.notFoundText}</Text>
                    <Button intent="neutral" href={APP_ROUTES.dashboard}>
                        {props.props.homeLabel}
                    </Button>
                </SurfaceCard>
            </Page>
        )
    }
    if (page === undefined) {
        return (
            <Page measure="reading">
                <div className={MAIN_CLASS_NAME}>
                    {props.props.failed ? (
                        <Alert tone="negative" title={props.props.failedTitle} description={props.props.failedBody} />
                    ) : (
                        <Text live="polite">{props.props.loadingLabel}</Text>
                    )}
                </div>
            </Page>
        )
    }
    return (
        <Page measure="reading">
            <WorkspaceShell
                align="stretch"
                primaryLabel={title}
                primary={
                    <div className={MAIN_CLASS_NAME}>
                        <Stack gap="section">
                            <Stack gap="identity">
                                <Heading level={1}>{title}</Heading>
                                <Text tone="muted">{page.shop}</Text>
                                {page.address === "" ? null : (
                                    <Text size="sm" tone="muted">
                                        {page.address}
                                    </Text>
                                )}
                                {page.note === "" ? null : <Text size="sm">{page.note}</Text>}
                            </Stack>
                            <PublicBookingForm key={page.slug} props={props.props.form} on={props.on} />
                        </Stack>
                    </div>
                }
            />
        </Page>
    )
}
