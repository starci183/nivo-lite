import { Alert, Button, Form, Input, Page, Stack, SurfaceCard, Textarea } from "@starci/grammar/common"
import { PublicShell } from "@/components/frames/PublicShell"
import type { WebsiteFormStatus, WebsiteFormValues } from "@/modules/types"

/** Props for {@link WebsiteFormBase}. */
export interface WebsiteFormBaseProps {
    readonly props: {
        readonly copy: {
            readonly title: string
            readonly intro: string
            readonly nameLabel: string
            readonly phoneLabel: string
            readonly messageLabel: string
            readonly submit: string
            readonly sentTitle: string
            readonly sentBody: string
            readonly again: string
            readonly offBody: string
            readonly emptyBody: string
            readonly failedBody: string
        }
        readonly values: WebsiteFormValues
        readonly status: WebsiteFormStatus
        readonly foot: string
        readonly brandFallback: string
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly isPending: boolean
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly setPhone: (value: string) => void
        readonly setMessage: (value: string) => void
        readonly submit: () => void
        readonly again: () => void
        readonly chooseLanguage: (locale: string) => void
    }
}

/** The words of what came of the last send, or nothing. */
const notice = (props: WebsiteFormBaseProps["props"]): string | null => {
    if (props.status === "off") return props.copy.offBody
    if (props.status === "empty") return props.copy.emptyBody
    return props.status === "failed" ? props.copy.failedBody : null
}

/** The hosted form of a shop website: a name, a phone and a message, or the thanks once it was sent. */
export const WebsiteFormBase = (props: WebsiteFormBaseProps) => {
    const { copy, values, status } = props.props
    const problem = notice(props.props)
    return (
        <Page chrome="bleed" minHeight="none">
            <PublicShell
                label={copy.title}
                foot={props.props.foot}
                measure="reading"
                brand={{ name: null, isLoading: false, fallbackLabel: props.props.brandFallback }}
                language={props.props.language}
                onChooseLanguage={props.on.chooseLanguage}
            >
            {status === "sent" ? (
                <SurfaceCard label={copy.title} note={copy.intro}>
                    <Stack gap="row">
                        <Alert tone="affirmative" title={copy.sentTitle} description={copy.sentBody} />
                        <Button intent="neutral" onPress={props.on.again}>
                            {copy.again}
                        </Button>
                    </Stack>
                </SurfaceCard>
            ) : (
                <SurfaceCard label={copy.title} note={copy.intro}>
                    <Form label={copy.title} onSubmit={props.on.submit} isPending={status === "sending"}>
                        <Stack gap="row">
                            <Input
                                id="website-form-name"
                                name="name"
                                label={copy.nameLabel}
                                value={values.name}
                                onValueChange={props.on.setName}
                                isDisabled={status === "sending"}
                            />
                            <Input
                                id="website-form-phone"
                                name="phone"
                                kind="tel"
                                label={copy.phoneLabel}
                                value={values.phone}
                                onValueChange={props.on.setPhone}
                                isDisabled={status === "sending"}
                            />
                            <Textarea
                                name="message"
                                label={copy.messageLabel}
                                rows={4}
                                value={values.message}
                                onValueChange={props.on.setMessage}
                                isDisabled={status === "sending"}
                            />
                            {problem === null ? null : <Alert tone="negative" title={problem} />}
                            <Button intent="commit" type="submit" isPending={status === "sending"}>
                                {copy.submit}
                            </Button>
                        </Stack>
                    </Form>
                </SurfaceCard>
            )}
            </PublicShell>
        </Page>
    )
}
