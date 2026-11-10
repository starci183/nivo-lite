"use client"

import { useTranslations } from "next-intl"
import { readFailureNotice } from "@/hooks/connectionPage"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import type { ConnectionNotice } from "@/modules/types"
import { useTelegramHead } from "./useTelegramHead"
import { useTelegramNotices } from "./useTelegramNotices"

type UseTelegramNoticeListResult = {
    /** The failure of the page read first, then why the bot cannot work, the refused command, a local site, no agent yet. */
    notices: ReadonlyArray<ConnectionNotice>
    /** Reads the page again after a failed read. */
    retry: () => void
}

/** Every notice of the main column of a Telegram bot page in reading order, with the retry of a page that could not be read. */
export const useTelegramNoticeList = (connectionId: string): UseTelegramNoticeListResult => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { head, notice } = useTelegramHead(connectionId)
    const notices = useTelegramNotices(connectionId, notice)
    const retry = (): void => router.refresh()
    const failure = readFailureNotice(head, slotLabels(t("factsEmpty")), retry)
    return { notices: failure === undefined ? notices : [failure, ...notices], retry }
}
