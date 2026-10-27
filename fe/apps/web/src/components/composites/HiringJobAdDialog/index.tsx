import { Alert, Button, Dialog, EmptyNotice, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import type { AdView } from "@/hooks/hiringWire"
import type { HiringSay } from "@/modules/types"
import { AD_CLASS_NAME, GRID_CLASS_NAME, HEAD_CLASS_NAME, PRE_WRAP_CLASS_NAME } from "./classNames"

/** The kinds of ad the dialog shows, in display order. */
const AD_KINDS: ReadonlyArray<keyof AdView> = ["facebook", "zalo", "topcv"]

/** The words, ads and state of the ad dialog. */
export interface HiringJobAdDialogProps {
    readonly props: {
        readonly say: HiringSay
        readonly title: string
        readonly ads: AdView | null
        readonly meta: string | null
        readonly publicUrl: string | null
        readonly copiedId: string | null
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly generate: () => void
        readonly copy: (id: string, text: string) => void
        readonly close: () => void
    }
}

/** The dialog with the three ready-to-paste variants of a job ad and the button that writes them. */
export const HiringJobAdDialog = (props: HiringJobAdDialogProps) => {
    const { say, ads, meta, publicUrl, copiedId, isBusy, error } = props.props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="lg"
            title={props.props.title}
            closeLabel={say("close")}
            description={say("adHint")}
            footer={<HiringJobAdDialogFooter {...props} />}
        >
            <div className={GRID_CLASS_NAME}>
                {error === null ? null : <Alert tone="negative" title={say("adFailed")} description={error} />}
                {isBusy ? (
                    <Text tone="muted" live="polite">
                        {say("adWriting")}
                    </Text>
                ) : null}
                {meta === null ? null : (
                    <Text size="sm" tone="muted">
                        {meta}
                    </Text>
                )}
                {ads === null && !isBusy ? (
                    <EmptyNotice message={say("adEmptyTitle")} description={say("adEmptyBody")} />
                ) : null}
                {ads === null
                    ? null
                    : AD_KINDS.map((kind) => (
                          <div key={kind} className={AD_CLASS_NAME}>
                              <div className={HEAD_CLASS_NAME}>
                                  <Heading level={3}>{say(`adKind_${kind}`)}</Heading>
                                  <Button intent="neutral" size="sm" onPress={() => on.copy(kind, ads[kind])}>
                                      {say(copiedId === kind ? "adCopied" : "adCopy")}
                                  </Button>
                              </div>
                              <SurfaceCard ariaLabel={say(`adKind_${kind}`)}>
                                  <div className={PRE_WRAP_CLASS_NAME}>
                                      <Text as="p" size="sm">
                                          {ads[kind]}
                                      </Text>
                                  </div>
                              </SurfaceCard>
                          </div>
                      ))}
                {publicUrl === null ? null : (
                    <Text size="sm" tone="muted">
                        {say("adLink", { url: publicUrl })}
                    </Text>
                )}
            </div>
        </Dialog>
    )
}

/** Keeps the dialog footer component stable as its fields change. */
const HiringJobAdDialogFooter = (props: HiringJobAdDialogProps) => {
    const { say, ads, isBusy } = props.props
    const { on } = props
    return (
        <>
            <Button intent="dismiss" onPress={on.close}>
                {say("close")}
            </Button>
            <Button intent="commit" isPending={isBusy} isDisabled={isBusy} onPress={on.generate}>
                {say(ads === null ? "adWrite" : "adRewrite")}
            </Button>
        </>
    )
}
