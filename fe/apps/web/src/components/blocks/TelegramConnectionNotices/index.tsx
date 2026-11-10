"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useTelegramNoticeList } from "@/hooks/telegramConnection"
import { TelegramConnectionNoticesBase } from "./component"

/** The connection of the url. */
interface TelegramConnectionNoticesProps {
    readonly connectionId: string
}

/** The connected notices of a Telegram bot page: the failed read with its retry, why the bot cannot work, a refused command, a local site, no agent yet. */
export const TelegramConnectionNotices = (props: TelegramConnectionNoticesProps) => {
    const { notices, retry } = useTelegramNoticeList(props.connectionId)
    const refusal = useConnectionRefusal()
    return (
        <TelegramConnectionNoticesBase
            props={{
                notices:
                    refusal === undefined
                        ? notices.map(({ action, ...notice }) => ({
                              ...notice,
                              ...(action === undefined ? {} : { actionLabel: action.label }),
                          }))
                        : [],
                ...(refusal === undefined ? {} : { refusal }),
            }}
            on={{ retry }}
        />
    )
}
