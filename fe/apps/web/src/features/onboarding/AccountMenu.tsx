"use client"

import { useTransition } from "react"
import { Avatar, Button, DropdownMenu, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { onboarding } from "@/i18n/dict/onboarding"
import { signOut } from "@/lib/actions"
import { ACCOUNT_EMAIL_CLASS_NAME } from "./classNames"

/** Props for {@link AccountMenu}. */
export type AccountMenuProps = {
    readonly email: string
    /** The Account page lives in the console, which needs a workspace: without one the item would only bounce back here. */
    readonly hasWorkspace: boolean
}

/** Top-bar account menu of the /workspaces area: the signed-in person's avatar and email open Account and Sign out. */
export const AccountMenu = ({ email, hasWorkspace }: AccountMenuProps) => {
    const t = useT(onboarding)
    const [isPending, start] = useTransition()
    return (
        <DropdownMenu
            placement="bottom end"
            entries={[
                ...(hasWorkspace ? [{ id: "account", label: t("accountMenu"), href: "/account" }] : []),
                {
                    id: "signout",
                    label: t("signOut"),
                    tone: "negative",
                    isDisabled: isPending,
                    onAction: () =>
                        start(async () => {
                            await signOut()
                        }),
                },
            ]}
            trigger={
                <Button variant="ghost" size="sm" startContent={<Avatar name={email} size="sm" isDecorative />}>
                    <span className={ACCOUNT_EMAIL_CLASS_NAME}>
                        <Text as="span" size="sm" overflow="truncate">
                            {email}
                        </Text>
                    </span>
                </Button>
            }
        />
    )
}
