import type { ProfileDocument } from "../workspace-profile.contracts"

/**
 * The playbooks HAKUEN gives its agents (its own documents, layer 2): which HAKUEN connector tools to call and in which order. The
 * agents read them through the per-turn knowledge recall, so the booking playbook is public (AI Sales is customer-facing and reads
 * public documents only); the grants and their argument bounds still decide what runs alone.
 */
export const HAKUEN_PLAYBOOK_DOCUMENTS: ReadonlyArray<ProfileDocument> = [
    {
        title: "HAKUEN \u00b7 Playbook \u0111\u1eb7t ph\u00f2ng",
        topic: "Playbook",
        module: "chatbot",
        visibility: "public",
        content: [
            "# Playbook \u0111\u1eb7t ph\u00f2ng HAKUEN",
            "",
            "Ph\u00f2ng tr\u1ed1ng v\u00e0 gi\u00e1 lu\u00f4n l\u1ea5y t\u1eeb h\u1ec7 th\u1ed1ng \u0111\u1eb7t ph\u00f2ng c\u1ee7a HAKUEN qua `tool.call`; kh\u00f4ng t\u1ef1 \u0111o\u00e1n.",
            "",
            "## C\u00e1c b\u01b0\u1edbc",
            "1. Ki\u1ec3m tra ph\u00f2ng tr\u1ed1ng: `hakuen.rooms.searchAvailability` v\u1edbi ng\u00e0y nh\u1eadn, ng\u00e0y tr\u1ea3 v\u00e0 s\u1ed1 kh\u00e1ch.",
            "2. B\u00e1o gi\u00e1: `hakuen.rates.quote` cho h\u1ea1ng ph\u00f2ng kh\u00e1ch ch\u1ecdn; b\u00e1o kh\u00e1ch \u0111\u00fang t\u1ed5ng ti\u1ec1n h\u1ec7 th\u1ed1ng tr\u1ea3 v\u1ec1.",
            "3. Gi\u1eef ph\u00f2ng: `hakuen.booking.hold` khi kh\u00e1ch \u0111\u1ed3ng \u00fd; b\u00e1o kh\u00e1ch th\u1eddi h\u1ea1n gi\u1eef ch\u1ed7 theo `expiresAt`.",
            "4. X\u00e1c nh\u1eadn: `hakuen.booking.confirm` v\u1edbi `holdId` khi kh\u00e1ch ch\u1ed1t; ch\u1ec9 b\u00e1o \u0111\u00e3 \u0111\u1eb7t sau khi h\u1ec7 th\u1ed1ng tr\u1ea3 `confirmed`.",
            "5. Sau khi x\u00e1c nh\u1eadn: chuy\u1ec3n cu\u1ed9c tr\u00f2 chuy\u1ec7n cho AI CSKH b\u1eb1ng c\u00f4ng c\u1ee5 NIVO `conversation.handOff`; AI CSKH ch\u0103m s\u00f3c kh\u00e1ch t\u1eeb l\u00fac nh\u1eadn ph\u00f2ng.",
            "",
            "## Gi\u1ea3m gi\u00e1",
            "- M\u1ecdi m\u1ee9c gi\u1ea3m gi\u00e1 v\u01b0\u1ee3t ch\u00ednh s\u00e1ch c\u1ea7n qu\u1ea3n l\u00fd duy\u1ec7t; b\u00e1o kh\u00e1ch \u0111ang ch\u1edd duy\u1ec7t, kh\u00f4ng h\u1ee9a tr\u01b0\u1edbc.",
            "",
            "## Khi h\u1ec7 th\u1ed1ng b\u00e1o l\u1ed7i",
            "- `NO_AVAILABILITY`: \u0111\u1ec1 xu\u1ea5t ng\u00e0y ho\u1eb7c h\u1ea1ng ph\u00f2ng kh\u00e1c b\u1eb1ng m\u1ed9t l\u1ea7n t\u00ecm m\u1edbi.",
            "- `HOLD_EXPIRED`: gi\u1eef ph\u00f2ng l\u1ea1i t\u1eeb b\u01b0\u1edbc 3 v\u00e0 b\u00e1o kh\u00e1ch gi\u00e1 c\u00f3 th\u1ec3 \u0111\u1ed5i.",
            "- L\u1ed7i kh\u00e1c ho\u1eb7c kh\u00f4ng tr\u1ea3 l\u1eddi: xin l\u1ed7i kh\u00e1ch v\u00e0 chuy\u1ec3n l\u1ec5 t\u00e2n.",
            "",
        ].join("\n"),
    },
    {
        title: "HAKUEN \u00b7 \u0110\u1ed1i so\u00e1t chuy\u1ec3n kho\u1ea3n",
        topic: "Playbook",
        module: "accounting",
        visibility: "internal",
        content: [
            "# \u0110\u1ed1i so\u00e1t chuy\u1ec3n kho\u1ea3n HAKUEN",
            "",
            "## Th\u1ee9 t\u1ef1",
            "1. \u0110\u1ecdc c\u00e1c kho\u1ea3n ti\u1ec1n v\u00e0o ng\u00e2n h\u00e0ng (SePay) qua connector.",
            "2. V\u1edbi m\u1ed7i kho\u1ea3n, chuy\u1ec3n nguy\u00ean v\u0103n n\u1ed9i dung chuy\u1ec3n kho\u1ea3n cho connector HAKUEN \u0111\u1ec3 t\u00ecm kho\u1ea3n ph\u1ea3i thu \u0111ang m\u1edf; HAKUEN t\u1ef1 \u0111\u1ecdc m\u00e3 thanh to\u00e1n c\u1ee7a m\u00ecnh (d\u1ea1ng HAKUEN k\u00e8m 6 k\u00fd t\u1ef1).",
            "3. T\u00ecm th\u1ea5y v\u00e0 s\u1ed1 ti\u1ec1n kh\u1edbp s\u1ed1 d\u01b0: ghi nh\u1eadn thanh to\u00e1n qua connector.",
            "4. Kh\u00f4ng t\u00ecm th\u1ea5y kho\u1ea3n ph\u1ea3i thu: \u0111\u01b0a v\u00e0o danh s\u00e1ch c\u1ea7n ng\u01b0\u1eddi x\u1eed l\u00fd.",
            "5. S\u1ed1 ti\u1ec1n kh\u00e1c s\u1ed1 d\u01b0 ph\u1ea3i thu: g\u1eedi y\u00eau c\u1ea7u duy\u1ec7t, kh\u00f4ng t\u1ef1 ghi nh\u1eadn.",
            "",
        ].join("\n"),
    },
]
