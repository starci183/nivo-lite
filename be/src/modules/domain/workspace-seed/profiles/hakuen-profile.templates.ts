import type { WorkspaceProfile } from "../workspace-profile.contracts"
import { HAKUEN_DOCUMENTS } from "./hakuen-documents.templates"
import { HAKUEN_HOSPITALITY_DOCUMENTS } from "./hakuen-hospitality.templates"
import { HAKUEN_PLAYBOOK_DOCUMENTS } from "./hakuen-playbook.templates"
import {
    HAKUEN_ACCOUNTING_SETUP,
    HAKUEN_CARE_SETUP,
    HAKUEN_EDITOR_SETUP,
    HAKUEN_MARKETING_SETUP,
    HAKUEN_SALES_SETUP,
} from "./hakuen-setup.templates"

/** Behavior shared by every HAKUEN agent; facts come from the documents and the connectors, never from here. */
const LAYERS =
    "D\u00f9ng d\u1eef li\u1ec7u theo th\u1ee9 t\u1ef1 \u01b0u ti\u00ean: d\u1eef li\u1ec7u s\u1ed1ng qua connector, t\u00e0i li\u1ec7u c\u1ee7a HAKUEN, b\u00e0i h\u1ecdc \u0111\u00e3 duy\u1ec7t, tri th\u1ee9c n\u1ec1n NIVO. " +
    "Ghi r\u00f5 ngu\u1ed3n \u0111\u00e3 d\u00f9ng trong m\u1ed7i \u0111\u1ec1 xu\u1ea5t."

/**
 * HAKUEN Hotel & Spa: the configuration its owner provided (brand, five agents, grants, workspace documents). No business records
 * are seeded; rooms, rates, bookings and folios are read live from the HAKUEN back office.
 */
export const HAKUEN_PROFILE: WorkspaceProfile = {
    key: "hakuen",
    workspaceName: "HAKUEN Hotel & Spa",
    displayName: "HAKUEN Hotel & Spa",
    logoUrl: "/brand/hakuen-logo.jpg",
    agents: [
        {
            module: "content",
            name: "AI Marketing",
            handle: "ai-marketing",
            role: "L\u00ean k\u1ebf ho\u1ea1ch, so\u1ea1n v\u00e0 h\u1eb9n gi\u1edd b\u00e0i \u0111\u0103ng Facebook, Zalo OA; b\u00e1o c\u00e1o hi\u1ec7u qu\u1ea3 h\u00e0ng tu\u1ea7n.",
            instructions: `So\u1ea1n b\u00e0i theo h\u01b0\u1edbng d\u1eabn th\u01b0\u01a1ng hi\u1ec7u HAKUEN, g\u1eedi b\u1ea3n nh\u00e1p v\u00e0o ph\u00f2ng Marketing \u0111\u1ec3 duy\u1ec7t tr\u01b0\u1edbc khi \u0111\u0103ng. Nh\u1edd AI Editor d\u1ef1ng video khi b\u00e0i c\u1ea7n video. ${LAYERS}`,
            room: "marketing",
            tools: [],
            setup: HAKUEN_MARKETING_SETUP,
        },
        {
            module: "video",
            name: "AI Editor",
            handle: "ai-editor",
            role: "D\u1ef1ng video ng\u1eafn 9:16 cho b\u00e0i \u0111\u0103ng t\u1eeb k\u1ecbch b\u1ea3n, \u1ea3nh v\u00e0 nh\u1ea1c \u0111\u00e3 duy\u1ec7t.",
            instructions: `Nh\u1eadn y\u00eau c\u1ea7u t\u1eeb AI Marketing, d\u1ef1ng b\u1ea3n nh\u00e1p, g\u1eedi th\u1ebb video v\u00e0o ph\u00f2ng Marketing. Kh\u00f4ng t\u1ef1 \u0111\u0103ng. ${LAYERS}`,
            room: "marketing",
            tools: [],
            setup: HAKUEN_EDITOR_SETUP,
        },
        {
            module: "chatbot",
            name: "AI Sales & \u0110\u1eb7t ch\u1ed7",
            handle: "ai-sales",
            role: "T\u01b0 v\u1ea5n, b\u00e1o gi\u00e1, gi\u1eef ph\u00f2ng v\u00e0 l\u1ecbch spa cho kh\u00e1ch qua Zalo, Messenger.",
            instructions: `Ki\u1ec3m tra ph\u00f2ng tr\u1ed1ng v\u00e0 gi\u00e1 qua connector HAKUEN tr\u01b0\u1edbc khi b\u00e1o. Ch\u01b0a c\u00f3 x\u00e1c nh\u1eadn gi\u1eef ch\u1ed7 th\u00ec kh\u00f4ng n\u00f3i \u0111\u00e3 gi\u1eef. M\u1ecdi gi\u00e1 kh\u00e1c b\u00e1o gi\u00e1 c\u1ee7a HAKUEN th\u00ec t\u1ea1o y\u00eau c\u1ea7u duy\u1ec7t. ${LAYERS}`,
            room: "sales",
            tools: [
                { tool: "hakuen.rooms.searchAvailability", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "hakuen.rates.quote", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "hakuen.booking.hold", mode: "auto", limitVnd: null, constraints: [] },
                {
                    tool: "hakuen.booking.confirm",
                    mode: "auto",
                    limitVnd: null,
                    constraints: [{ arg: "discountPct", max: 0 }],
                },
                { tool: "hakuen.folio.get", mode: "auto", limitVnd: null, constraints: [] },
            ],
            setup: HAKUEN_SALES_SETUP,
        },
        {
            module: "chatbot",
            name: "AI CSKH",
            handle: "ai-cskh",
            role: "Ch\u0103m s\u00f3c kh\u00e1ch \u0111ang l\u01b0u tr\u00fa: nh\u1eadn ph\u00f2ng, nh\u1eadn s\u1edbm, y\u00eau c\u1ea7u trong k\u1ef3 \u1edf, sau tr\u1ea3 ph\u00f2ng.",
            instructions: `Nh\u1eadn kh\u00e1ch t\u1eeb AI Sales khi kh\u00e1ch \u0111\u00e3 nh\u1eadn ph\u00f2ng. M\u00e3 kh\u00f3a ch\u1ec9 g\u1eedi cho \u0111\u00fang kh\u00e1ch qua connector. Khi\u1ebfu n\u1ea1i chuy\u1ec3n cho l\u1ec5 t\u00e2n. ${LAYERS}`,
            room: "care",
            tools: [
                { tool: "hakuen.stay.*", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "hakuen.guest.*", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "hakuen.folio.get", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "hakuen.keycode.reveal", mode: "ask", limitVnd: null, constraints: [] },
            ],
            setup: HAKUEN_CARE_SETUP,
        },
        {
            module: "accounting",
            name: "AI K\u1ebf to\u00e1n",
            handle: "ai-ke-toan",
            role: "\u0110\u1ed1i so\u00e1t thanh to\u00e1n, \u0111\u1ec1 ngh\u1ecb xu\u1ea5t h\u00f3a \u0111\u01a1n \u0111i\u1ec7n t\u1eed, nh\u1eafc l\u1ecbch thu\u1ebf, t\u00f3m t\u1eaft cu\u1ed1i ng\u00e0y.",
            instructions: `\u0110\u1ed1i chi\u1ebfu folio v\u1edbi giao d\u1ecbch ng\u00e2n h\u00e0ng, \u0111\u1ec1 ngh\u1ecb xu\u1ea5t h\u00f3a \u0111\u01a1n theo h\u1ea1n m\u1ee9c, nh\u1eafc h\u1ea1n k\u00ea khai theo h\u1ed3 s\u01a1 thu\u1ebf. Kh\u00f4ng \u01b0\u1edbc t\u00ednh s\u1ed1 li\u1ec7u c\u00f2n thi\u1ebfu. ${LAYERS}`,
            room: "accounting",
            tools: [
                { tool: "sepay.*", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "einvoice.*", mode: "auto", limitVnd: null, constraints: [] },
                { tool: "hakuen.folio.*", mode: "auto", limitVnd: null, constraints: [] },
            ],
            setup: HAKUEN_ACCOUNTING_SETUP,
        },
    ],
    rules: [
        {
            department: "content",
            action: "draft_post",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "So\u1ea1n nh\u00e1p t\u1ef1 do.",
        },
        {
            department: "content",
            action: "publish_post",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: "M\u1ecdi b\u00e0i \u0111\u0103ng c\u1ea7n qu\u1ea3n l\u00fd duy\u1ec7t.",
        },
        {
            department: "video",
            action: "render_draft",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "D\u1ef1ng nh\u00e1p t\u1ef1 do.",
        },
        {
            department: "video",
            action: "publish_video",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: "Video \u0111\u0103ng c\u00f4ng khai c\u1ea7n duy\u1ec7t.",
        },
        {
            department: "chatbot",
            action: "reply_customer",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "Tr\u1ea3 l\u1eddi trong ch\u00ednh s\u00e1ch \u0111\u00e3 c\u00f3.",
        },
        {
            department: "chatbot",
            action: "handoff_lead",
            mode: "auto",
            limit_vnd: null,
            required_fields: ["contact_name", "need"],
            note: "Chuy\u1ec3n l\u1ec5 t\u00e2n khi ngo\u00e0i ch\u00ednh s\u00e1ch.",
        },
        {
            department: "booking",
            action: "confirm_booking",
            mode: "auto",
            limit_vnd: null,
            required_fields: ["contact"],
            note: "Gi\u00e1 kh\u00e1c b\u00e1o gi\u00e1 c\u1ee7a HAKUEN c\u1ea7n qu\u1ea3n l\u00fd duy\u1ec7t.",
        },
        {
            department: "booking",
            action: "cancel_with_fee",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: "Thu ph\u00ed h\u1ee7y c\u1ea7n qu\u1ea3n l\u00fd duy\u1ec7t.",
        },
        {
            department: "accounting",
            action: "issue_invoice",
            mode: "auto",
            limit_vnd: 20_000_000,
            required_fields: ["customer", "amount_vnd"],
            note: "T\u1eeb 20.000.000 \u20ab c\u1ea7n k\u1ebf to\u00e1n tr\u01b0\u1edfng duy\u1ec7t.",
        },
        {
            department: "accounting",
            action: "reconcile_payment",
            mode: "auto",
            limit_vnd: 50_000_000,
            required_fields: ["amount_vnd"],
            note: "Kh\u1edbp t\u1ef1 \u0111\u1ed9ng d\u01b0\u1edbi 50.000.000 \u20ab.",
        },
        {
            department: "accounting",
            action: "send_email",
            mode: "ask",
            limit_vnd: null,
            required_fields: ["contact"],
            note: "Email cho kh\u00e1ch c\u1ea7n duy\u1ec7t.",
        },
    ],
    connectors: [
        {
            key: "hakuen",
            name: "HAKUEN Back Office",
            credentialRef: "MCP_HAKUEN_CLIENT_SECRET",
            contractVersion: "hakuen-mcp@1",
        },
    ],
    documents: [...HAKUEN_DOCUMENTS, ...HAKUEN_HOSPITALITY_DOCUMENTS, ...HAKUEN_PLAYBOOK_DOCUMENTS],
}
