import { LEAD_GEN_ACTIONS, LEAD_GEN_COMMANDS } from "./lead-gen-flow.contracts"
import { LEAD_GEN_GATES } from "./lead-gen-gates.contracts"
import type { ModuleDefinition } from "./modules.contracts"

/** The lead_gen module: its copy and agent; the gates and the authority flow live beside it. */
export const LEAD_GEN_MODULE: ModuleDefinition = {
    key: "lead_gen",
    order: 15,
    name: {
        vi: "T\u1ea1o lead",
        en: "Lead generation",
    },
    shortName: {
        vi: "T\u1ea1o lead AI",
        en: "Lead Gen AI",
    },
    description: {
        vi: "Thu v\u00e0 l\u1ecdc kh\u00e1ch ti\u1ec1m n\u0103ng t\u1eeb Facebook v\u00e0 Instagram (form qu\u1ea3ng c\u00e1o, tin nh\u1eafn, b\u00ecnh lu\u1eadn, l\u01b0\u1ee3t nh\u1eafc t\u00ean), r\u1ed3i chuy\u1ec3n kh\u00e1ch n\u00f3ng cho Sales.",
        en: "Captures and qualifies leads from Facebook and Instagram (Lead Ads forms, DMs, post comments, mentions), then hands hot leads to Sales.",
    },
    points: {
        vi: [
            "Thu kh\u00e1ch t\u1eeb form, tin nh\u1eafn v\u00e0 b\u00ecnh lu\u1eadn",
            "H\u1ecfi t\u1ed1i \u0111a 4 c\u00e2u \u0111\u1ec3 ch\u1ea5m n\u00f3ng, \u1ea5m, l\u1ea1nh",
            "Chuy\u1ec3n kh\u00e1ch n\u00f3ng cho Sales k\u00e8m nhu c\u1ea7u",
        ],
        en: [
            "Captures leads from forms, DMs and comments",
            "Asks at most 4 questions to score hot, warm or cold",
            "Hands hot leads to Sales with their need",
        ],
    },
    purpose:
        "a lead generation assistant that captures and qualifies prospects from Facebook and Instagram (Lead Ads forms, Messenger and Instagram DMs, post comments, Instagram mentions) within the 24-hour messaging window, and hands hot leads to Sales",
    icon: "community",
    glyph: "M4 5h16l-6 8v6l-4-2v-4z",
    mascot: "/images/promo/mascot-chat.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "lead_gen",
    workbench: "lead_gen",
    settingsExtras: null,
    requires: {
        capabilities: [],
        connections: ["meta"],
    },
    connectionProviders: ["meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    agent: {
        name: "Lead Gen Agent",
        handle: "leadgen",
        summary: {
            vi: "Thu v\u00e0 l\u1ecdc kh\u00e1ch ti\u1ec1m n\u0103ng t\u1eeb Facebook v\u00e0 Instagram, ch\u1ea5m n\u00f3ng, \u1ea5m, l\u1ea1nh r\u1ed3i chuy\u1ec3n kh\u00e1ch n\u00f3ng cho Sales.",
            en: "Captures and qualifies leads from Facebook and Instagram, scores them hot, warm or cold and hands hot leads to Sales.",
        },
        capabilities: {
            vi: [
                "Thu kh\u00e1ch t\u1eeb form qu\u1ea3ng c\u00e1o, tin nh\u1eafn, b\u00ecnh lu\u1eadn v\u00e0 l\u01b0\u1ee3t nh\u1eafc t\u00ean",
                "H\u1ecfi t\u1ed1i \u0111a 4 c\u00e2u \u0111\u1ec3 ch\u1ea5m \u0111i\u1ec3m kh\u00e1ch",
                "Tr\u1ea3 l\u1eddi b\u00ecnh lu\u1eadn c\u00f4ng khai, nh\u1eafn ri\u00eang \u0111\u00fang m\u1ed9t l\u1ea7n",
                "Chuy\u1ec3n kh\u00e1ch n\u00f3ng cho Sales",
                "Kh\u00f4ng nh\u1eafn ngo\u00e0i khung 24 gi\u1edd, kh\u00f4ng h\u1ee9a gi\u00e1",
            ],
            en: [
                "Captures leads from Lead Ads forms, DMs, comments and mentions",
                "Asks at most 4 questions to score a lead",
                "Replies to public comments and sends one private reply",
                "Hands hot leads to Sales",
                "Never messages outside the 24-hour window or promises prices",
            ],
        },
        role: {
            vi: "Thu v\u00e0 l\u1ecdc kh\u00e1ch ti\u1ec1m n\u0103ng t\u1eeb m\u1ea1ng x\u00e3 h\u1ed9i",
            en: "Social lead capture & qualification",
        },
        instructions: {
            vi: "Ch\u00e0o kh\u00e1ch b\u1eb1ng th\u00f4ng tin c\u00f4ng khai, h\u1ecfi t\u1ed1i \u0111a 4 c\u00e2u theo b\u1ed9 c\u00e2u h\u1ecfi \u0111\u00e3 duy\u1ec7t r\u1ed3i ch\u1ea5m n\u00f3ng, \u1ea5m ho\u1eb7c l\u1ea1nh. Ch\u1ec9 nh\u1eafn trong khung 24 gi\u1edd k\u1ec3 t\u1eeb tin cu\u1ed1i c\u1ee7a kh\u00e1ch. V\u1edbi b\u00ecnh lu\u1eadn, tr\u1ea3 l\u1eddi c\u00f4ng khai ng\u1eafn g\u1ecdn v\u00e0 nh\u1eafn ri\u00eang \u0111\u00fang m\u1ed9t l\u1ea7n cho m\u1ed7i b\u00ecnh lu\u1eadn. Kh\u00f4ng nh\u1eafc \u0111\u1ed1i th\u1ee7, kh\u00f4ng xin CCCD hay th\u00f4ng tin ng\u00e2n h\u00e0ng, kh\u00f4ng h\u1ee9a gi\u00e1 hay \u01b0u \u0111\u00e3i ch\u01b0a \u0111\u01b0\u1ee3c duy\u1ec7t. Kh\u00e1ch khi\u1ebfu n\u1ea1i, \u0111\u00f2i ho\u00e0n ti\u1ec1n, b\u1ef1c b\u1ed9i, h\u1ecfi c\u00f3 ph\u1ea3i ng\u01b0\u1eddi th\u1eadt kh\u00f4ng, ho\u1eb7c \u0111\u1ed9 tin c\u1eady d\u01b0\u1edbi 0,6 th\u00ec chuy\u1ec3n cho ng\u01b0\u1eddi.",
            en: 'Greet people using public information, ask at most 4 questions from the approved set, then score the lead hot, warm or cold. Message only within 24 hours of the person\'s last message. For comments, reply briefly in public and send one private reply per comment. Never mention competitors, never ask for ID or bank details, never promise a price or offer that is not approved. Hand over to a person on a complaint, refund request, anger, the question "is this a real person", or confidence below 0.6.',
        },
    },
    gates: LEAD_GEN_GATES,
    authorityActions: LEAD_GEN_ACTIONS,
    accepts: LEAD_GEN_COMMANDS,
}
