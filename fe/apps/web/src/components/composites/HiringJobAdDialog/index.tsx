import type { HiringViews, HiringActions } from "@/modules/types"

import { Stack, Alert, Button, Dialog, EmptyNotice, Quote, Section, Text } from "@starci/grammar/common"

/** The kinds of ad the dialog shows, in display order. */
const AD_KINDS: ReadonlyArray<keyof HiringViews["adData"]> = ["facebook", "zalo", "topcv"]

/** The words, ads and state of the ad dialog. */
type HiringJobAdDialogProps = HiringViews["jobAdFields"] & {
    readonly on: HiringActions["jobAdActions"]
}

/** The dialog with the three ready-to-paste variants of a job ad and the button that writes them. */
export const HiringJobAdDialog = (props: HiringJobAdDialogProps) => {
    const { copy, ads, meta, publicUrl, copiedId, isBusy, error } = props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={props.title}
            closeLabel={copy.close}
            description={copy.adHint}
            footer={<HiringJobAdDialogFooter {...props} />}
        >
            <Stack gap="row">
                {error === null ? null : <Alert tone="negative" title={copy.adFailed} description={error} />}
                {isBusy ? (
                    <Text tone="muted" live="polite">
                        {copy.adWriting}
                    </Text>
                ) : null}
                {meta === null ? null : (
                    <Text size="sm" tone="muted">
                        {meta}
                    </Text>
                )}
                {ads === null && !isBusy ? (
                    <EmptyNotice message={copy.adEmptyTitle} description={copy.adEmptyBody} />
                ) : null}
                {ads === null
                    ? null
                    : AD_KINDS.map((kind) => (
                          <Section
                              key={kind}
                              title={props.kindLabels[kind]}
                              headingLevel={3}
                              action={
                                  <Button intent="neutral" size="sm" onPress={() => on.copy(kind, ads[kind])}>
                                      {copiedId === kind ? copy.adCopied : copy.adCopy}
                                  </Button>
                              }
                          >
                              <Quote text={ads[kind]} />
                          </Section>
                      ))}
                {publicUrl === null ? null : (
                    <Text size="sm" tone="muted">
                        {props.publicLinkLabel}
                    </Text>
                )}
            </Stack>
        </Dialog>
    )
}

/** Keeps the dialog footer component stable as its fields change. */
const HiringJobAdDialogFooter = (props: HiringJobAdDialogProps) => {
    const { copy, ads, isBusy } = props
    const { on } = props
    return (
        <>
            <Button intent="dismiss" onPress={on.close}>
                {copy.close}
            </Button>
            <Button intent="commit" isPending={isBusy} isDisabled={isBusy} onPress={on.generate}>
                {ads === null ? copy.adWrite : copy.adRewrite}
            </Button>
        </>
    )
}
