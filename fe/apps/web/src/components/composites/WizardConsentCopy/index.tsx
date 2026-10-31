import { Alert, Text } from "@starci/grammar/common"
import { wizardConsentCopyClassNames as classNames } from "./classNames"

/** Props for {@link WizardConsentCopy}. */
type WizardConsentCopyProps = {
    /** What the person is about to allow, as a heading line. */
    readonly title: string
    /** The first line says what is allowed; the rest say what is not, and how to take it back. */
    readonly lines: ReadonlyArray<string>
    /** The sentence of why the provider did not connect, or null; shown under the lines with `failTitle`. */
    readonly refusal: string | null
    readonly failTitle: string
}

/** The consent step of a wizard that sends the owner to a provider: what NIVO will be allowed, in a few short lines, then the refusal if one came back. */
export const WizardConsentCopy = (props: WizardConsentCopyProps) => (
    <div className={classNames.copy}>
        <Text weight="semibold">{props.title}</Text>
        {props.lines.map((line, index) => (
            <Text key={line} size="sm" {...(index === 0 ? {} : { tone: "muted" as const })}>
                {line}
            </Text>
        ))}
        {props.refusal === null ? null : <Alert tone="negative" title={`${props.failTitle}. ${props.refusal}`} />}
    </div>
)
