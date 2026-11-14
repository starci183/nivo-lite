import type { ModuleContactBlock } from "@nivo-lite/agent-sdk/module"

/**
 * The Chatbot's blocks on the contact detail: the person's conversations with this agent (the first rows, newest first; the inbox holds
 * the rest), drawn by the generic record list over the Chatbot's own read. The Chatbot is the one module of its package whose records
 * carry a `contact()` field; the host card already is the surface, so the list is plain.
 */
export const CHATBOT_CONTACT_BLOCKS: ReadonlyArray<ModuleContactBlock> = [
    {
        id: "conversations",
        title: { vi: "Hội thoại", en: "Conversations" },
        read: "blocks-core.chatbot.api.chat.of-contact",
        block: {
            id: "core.record-list",
            slot: "rows",
            props: {
                label: { key: "list_label" },
                empty: { key: "list_empty" },
                idPath: "id",
                titlePath: "name",
                descriptionPath: "lastText",
                badgePath: "status",
                metaPath: "channel",
                badgeTones: { needs: "warning", handled: "neutral", ai: "neutral" },
                labels: {
                    status: {
                        needs: { key: "status_needs" },
                        handled: { key: "status_handled" },
                        ai: { key: "status_ai" },
                    },
                    channel: {
                        telegram: { key: "channel_telegram" },
                        zalo: { key: "channel_zalo" },
                        facebook: { key: "channel_facebook" },
                        instagram: { key: "channel_instagram" },
                        website: { key: "channel_website" },
                    },
                },
                surface: "plain",
            },
        },
    },
]
