"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { CheckboxGroup, SearchField, Text } from "@starci/grammar/common"
import { MAX_CHATS } from "@/hooks/telegram-user-wizard"
import type { ChatChoice, PickedChat } from "@/hooks/telegram-user-wizard"

/** Props for {@link ChatPicker}. */
export type ChatPickerProps = {
    readonly chats: ReadonlyArray<ChatChoice>
    readonly picked: ReadonlyArray<PickedChat>
    readonly onPicked: (next: ReadonlyArray<PickedChat>) => void
    readonly isDisabled?: boolean
}

/** Searchable list of recent chats with a tick each (at most MAX_CHATS). Ticks survive a change of the search text. */
export const ChatPicker = ({ chats, picked, onPicked, isDisabled }: ChatPickerProps) => {
    const t = useTranslations("connectorTelegramUser")
    const [query, setQuery] = useState("")
    const kindName = { user: t("kindUser"), group: t("kindGroup"), channel: t("kindChannel") } as const
    const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked])
    // Chats ticked earlier but no longer among the recent ones stay listed so they can be unticked.
    const all = useMemo<ReadonlyArray<ChatChoice>>(
        () => [...chats, ...picked.filter((p) => !chats.some((c) => c.id === p.id)).map((p) => ({ ...p, unread: 0 }))],
        [chats, picked],
    )
    const q = query.trim().toLowerCase()
    const visible = q ? all.filter((c) => c.title.toLowerCase().includes(q)) : all
    const full = picked.length >= MAX_CHATS

    const change = (ids: ReadonlyArray<string>) => {
        const visibleIds = new Set(visible.map((c) => c.id))
        const kept = picked.filter((p) => !visibleIds.has(p.id))
        const added = ids
            .map((id) => all.find((c) => c.id === id))
            .filter((c): c is ChatChoice => Boolean(c))
            .map((c) => ({ id: c.id, title: c.title, kind: c.kind }))
        onPicked([...kept, ...added].slice(0, MAX_CHATS))
    }

    return (
        <>
            <Text size="sm" tone="muted">
                {t("chatsHint", { max: MAX_CHATS })}
            </Text>
            <SearchField
                variant="secondary"
                label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                isDisabled={isDisabled}
                value={query}
                onValueChange={setQuery}
                onClear={() => setQuery("")}
            />
            <Text size="sm" live="polite">
                {t("pickedCount", { n: picked.length, max: MAX_CHATS })}
            </Text>
            {visible.length === 0 ? (
                <Text size="sm" tone="muted">
                    {t("chatsEmpty")}
                </Text>
            ) : (
                <CheckboxGroup
                    variant="secondary"
                    label={t("stepChats")}
                    isLabelHidden
                    isDisabled={isDisabled}
                    options={visible.map((c) => ({
                        value: c.id,
                        label: c.title,
                        description:
                            c.unread > 0 ? `${kindName[c.kind]} · ${t("unread", { n: c.unread })}` : kindName[c.kind],
                        isDisabled: full && !pickedIds.has(c.id),
                    }))}
                    value={visible.filter((c) => pickedIds.has(c.id)).map((c) => c.id)}
                    onValueChange={change}
                />
            )}
        </>
    )
}
