"use client"

import { useTranslations } from "next-intl"
import { useInboxSimulator } from "@/hooks/inbox"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { InboxSimulatorBase } from "./component"

/** Channels the simulator can send from (website chat is real and lives in the Chatbot). */
const CHANNELS = ["zalo", "facebook", "email", "phone", "bank", "manual"] as const
/** Kinds the simulator can send. */
const KINDS = ["message", "order", "payment"] as const

/** Props for the connected simulator. */
interface InboxSimulatorProps {
    /** The first channel event id (generated on the server so it agrees with hydration). */
    readonly initialEventId: string
}

/**
 * Inbound simulator: a labelled form plus one-click presets that only fill it. One primary action sends it into NIVO. Every submission carries a
 * channel event id: sending the same id again is a duplicate (a redelivery), a new id is a new input even when the text is identical.
 */
export const InboxSimulator = (props: InboxSimulatorProps) => {
    const t = useTranslations("inbox")
    const g = useTranslations("governance")
    const simulator = useInboxSimulator(props.initialEventId)
    return (
        <InboxSimulatorBase
            props={{
                title: t("simTitle"),
                description: t("simDesc"),
                presetsLabel: t("presetsLabel"),
                presets: [
                    { id: "zalo", label: t("presetZalo") },
                    { id: "o5", label: t("presetOrder5") },
                    { id: "o45", label: t("presetOrder45") },
                    { id: "o0", label: t("presetOrderNoAmount") },
                    { id: "bank", label: t("presetBankUnknown") },
                ],
                labels: {
                    channel: t("channel"),
                    kind: t("kind"),
                    name: t("senderName"),
                    nameHint: t("senderNameHint"),
                    contact: t("contact"),
                    body: t("body"),
                    items: t("items"),
                    amount: t("amount"),
                    reference: t("reference"),
                    eventId: t("eventId"),
                    eventIdHint: t("eventIdHint"),
                    eventIdNew: t("eventIdNew"),
                    submit: t("submit"),
                    failTitle: t("failTitle"),
                    resultLead: t("resultLead"),
                    resultOffice: t("resultOffice"),
                },
                channels: CHANNELS.map((channel) => ({ id: channel, label: g(`channel_${channel}`) })),
                kinds: KINDS.map((kind) => ({ id: kind, label: g(`kind_${kind}`) })),
                values: simulator.values,
                showItems: simulator.values.kind === "order",
                errors: simulator.errors,
                failure: simulator.failure,
                result: simulator.result,
                officeHref: CONSOLE_ROUTES.chat,
                isPending: simulator.isPending,
            }}
            on={{
                preset: simulator.applyPreset,
                change: simulator.change,
                newEventId: simulator.renewEventId,
                submit: simulator.submit,
            }}
        />
    )
}
