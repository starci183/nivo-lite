import { Input, Text } from "@starci/grammar/common"
import { telegramUserLoginClassNames as classNames } from "./classNames"

/** A field of the personal Telegram login. */
type TelegramLoginField = "phone" | "code" | "password"

/** What the login step of the personal Telegram wizard draws and reports. */
type TelegramUserLoginProps = {
    readonly stage: TelegramLoginField
    /** Where Telegram sent the code; null before it was sent. */
    readonly sentLine: string | null
    readonly values: Readonly<Record<TelegramLoginField, string>>
    readonly isDisabled: boolean
    readonly text: Readonly<
        Record<"phone" | "phoneHint" | "code" | "codeHint" | "passwordTitle" | "password" | "passwordHint", string>
    >
    readonly onField: (field: TelegramLoginField, value: string) => void
}

/** Step "login": the phone number, then the code Telegram sent, then (when the account has it) the two-step password. */
export const TelegramUserLogin = (props: TelegramUserLoginProps) => {
    const { text, values, isDisabled, onField } = props
    return (
        <div className={classNames.fields}>
            {props.stage === "phone" ? (
                <Input
                    id="tgu-phone"
                    name="phone"
                    kind="tel"
                    label={text.phone}
                    hint={text.phoneHint}
                    isDisabled={isDisabled}
                    value={values.phone}
                    onValueChange={(value) => onField("phone", value)}
                />
            ) : null}
            {props.stage === "code" ? (
                <>
                    {props.sentLine === null ? null : (
                        <Text size="sm" live="polite">
                            {props.sentLine}
                        </Text>
                    )}
                    <Input
                        id="tgu-code"
                        name="code"
                        kind="code"
                        label={text.code}
                        hint={text.codeHint}
                        isDisabled={isDisabled}
                        value={values.code}
                        onValueChange={(value) => onField("code", value)}
                    />
                </>
            ) : null}
            {props.stage === "password" ? (
                <>
                    <Text size="sm" weight="semibold">
                        {text.passwordTitle}
                    </Text>
                    <Input
                        id="tgu-password"
                        name="password"
                        kind="password"
                        label={text.password}
                        hint={text.passwordHint}
                        isDisabled={isDisabled}
                        value={values.password}
                        onValueChange={(value) => onField("password", value)}
                    />
                </>
            ) : null}
        </div>
    )
}
