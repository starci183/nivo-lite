import type { OfficeProfile } from "../office-seed.contracts"

/**
 * The video story of v0.3.2 ("Van phong so") as a workspace: Nam (owner), anh Minh (manager, discount up to 15 percent), chi Ha
 * (manager, up to 10), Van (accounting), Lan (sales); the rooms Ban dieu hanh, Sales, Ke toan, CSKH and Marketing; four agents
 * with a person in charge and the agents each may tag. It is for local and UAT workspaces: its workspace name is not the
 * production HAKUEN profile's, and it writes no business records.
 */
export const HAKUEN_OFFICE: OfficeProfile = {
    key: "hakuen-office",
    workspaceName: "HAKUEN Hotel & Spa (UAT)",
    people: {
        nam: { role: "owner", room: "executive" },
        minh: { role: "manager", room: "sales" },
        ha: { role: "manager", room: "sales" },
        van: { role: "staff", room: "accounting" },
        lan: { role: "staff", room: "sales" },
    },
    agents: {
        sales: {
            module: "sales",
            name: "AI Sales",
            handle: "office-ai-sales",
            role: "Tr\u1ee3 l\u00fd b\u00e1n h\u00e0ng c\u1ee7a Ph\u00f2ng Sales: ch\u1ed1t \u0111o\u00e0n, xin duy\u1ec7t gi\u1ea3m gi\u00e1.",
            instructions:
                "Ch\u1ed1t ph\u00f2ng cho kh\u00e1ch. Gi\u1ea3m gi\u00e1 v\u01b0\u1ee3t m\u1ee9c t\u1ef1 \u0111\u1ed9ng th\u00ec tag qu\u1ea3n l\u00fd Sales \u0111\u1ec3 xin duy\u1ec7t, kh\u00f4ng t\u1ef1 h\u1ee9a. Sau khi \u0111\u01b0\u1ee3c duy\u1ec7t, chuy\u1ec3n cho K\u1ebf to\u00e1n AI xu\u1ea5t ho\u00e1 \u0111\u01a1n.",
            room: "sales",
            owner: "minh",
            fallback: "nam",
            assignableRoles: ["owner", "manager"],
            assignableRooms: ["sales"],
            canTag: ["accounting", "care"],
        },
        accounting: {
            module: "accounting",
            name: "K\u1ebf to\u00e1n AI",
            handle: "office-ke-toan-ai",
            role: "\u0110\u1ed1i chi\u1ebfu th\u00f4ng tin xu\u1ea5t ho\u00e1 \u0111\u01a1n, ph\u00e1t hi\u1ec7n sai l\u1ec7ch m\u00e3 s\u1ed1 thu\u1ebf.",
            instructions:
                "Ki\u1ec3m tra m\u00e3 s\u1ed1 thu\u1ebf v\u00e0 th\u00f4ng tin xu\u1ea5t ho\u00e1 \u0111\u01a1n. Khi l\u1ec7ch th\u00ec tag K\u1ebf to\u00e1n (ng\u01b0\u1eddi) s\u1eeda; xong th\u00ec chuy\u1ec3n AI CSKH x\u00e1c nh\u1eadn v\u1edbi kh\u00e1ch.",
            room: "accounting",
            owner: "van",
            fallback: "nam",
            assignableRoles: ["owner", "manager"],
            assignableRooms: ["accounting"],
            canTag: ["care"],
        },
        care: {
            module: "chatbot",
            name: "AI CSKH",
            handle: "office-ai-cskh",
            role: "Ch\u0103m s\u00f3c kh\u00e1ch: x\u00e1c nh\u1eadn v\u00e0 theo d\u00f5i sau khi ch\u1ed1t.",
            instructions:
                "Nh\u1eadn vi\u1ec7c t\u1eeb c\u00e1c agent kh\u00e1c, x\u00e1c nh\u1eadn v\u1edbi kh\u00e1ch b\u1eb1ng th\u00f4ng tin \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t. Kh\u00f4ng cam k\u1ebft th\u00eam \u0111i\u1ec1u g\u00ec ngo\u00e0i ch\u00ednh s\u00e1ch.",
            room: "care",
            owner: "ha",
            fallback: "nam",
            assignableRoles: ["owner", "manager"],
            assignableRooms: ["care", "sales"],
            canTag: [],
        },
        marketing: {
            module: "content",
            name: "AI Marketing",
            handle: "office-ai-marketing",
            role: "So\u1ea1n b\u00e0i \u0111\u0103ng v\u00e0 chuy\u1ec3n kh\u00e1ch quan t\u00e2m cho AI Sales.",
            instructions:
                "So\u1ea1n b\u00e0i theo h\u01b0\u1edbng d\u1eabn th\u01b0\u01a1ng hi\u1ec7u. Khi c\u00f3 kh\u00e1ch h\u1ecfi mua, chuy\u1ec3n cho AI Sales.",
            room: "marketing",
            owner: "ha",
            fallback: "nam",
            assignableRoles: ["owner", "manager"],
            assignableRooms: ["marketing"],
            canTag: ["sales"],
        },
    },
}
