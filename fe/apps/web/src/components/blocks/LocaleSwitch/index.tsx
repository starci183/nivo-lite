"use client"

import { useLocaleSwitch } from "@/hooks/locale"
import { LocaleSwitchBase } from "./component"

/** The language menu for pages outside the console (sign-in, billing, new workspace), the same globe menu as the console bar: the language is stored in the cookie. */
export const LocaleSwitch = () => {
    const language = useLocaleSwitch()
    return (
        <LocaleSwitchBase
            props={{
                label: language.label,
                locale: language.locale,
                isPending: language.isPending,
                options: language.options,
            }}
            on={{ choose: language.choose }}
        />
    )
}
