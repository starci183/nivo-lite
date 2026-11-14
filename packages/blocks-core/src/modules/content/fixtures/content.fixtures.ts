import { STARTER_BRAND } from "../../../rules/content/brand"
import { brandFormOf, type PostView } from "../../../rules/content/workbench"
import type { ModuleFixtures } from "../../module-fixtures"

/** A drafted post of the prototype. */
const DRAFT: PostView = {
    id: "post-1",
    title: "Flowers to thank a teacher",
    channel: "facebook",
    status: "draft",
    day: "2026-11-19",
    time: "19:30",
    pillar: "Products and services",
    brief: "A small bouquet for 20/11",
    text: "Teachers' Day is close: small bouquets to say thank you.",
    note: "A bouquet on a wooden table",
    hasMedia: false,
    publishedAt: null,
    url: null,
    isDraft: true,
    isApproved: false,
}

/** An approved post of the prototype, waiting to be published. */
const APPROVED: PostView = {
    ...DRAFT,
    id: "post-2",
    title: "Keeping flowers fresh longer",
    channel: "zalo",
    status: "approved",
    day: "2026-11-18",
    time: "10:00",
    pillar: "Useful knowledge",
    isDraft: false,
    isApproved: true,
}

/** The fixtures of the Content module: what the prototype data port answers for each read and action. */
export const CONTENT_FIXTURES: ModuleFixtures = {
    reads: {
        "blocks-core.content.api.post.list": { ready: { rows: [DRAFT, APPROVED], cursor: null }, empty: { rows: [], cursor: null } },
        "blocks-core.content.api.post.get": { ready: DRAFT },
        "blocks-core.content.api.brand.get": { ready: brandFormOf("", STARTER_BRAND) },
        "blocks-core.content.api.post.week": {
            ready: { from: "2026-11-16", to: "2026-11-22", planned: 4, drafts: 2, approved: 1, published: 1 },
            empty: { from: "2026-11-16", to: "2026-11-22", planned: 0, drafts: 0, approved: 0, published: 0 },
        },
    },
    actions: {
        "blocks-core.content.brand-save": { ok: true, data: { id: "brand-1" } },
        "blocks-core.content.post-save": { ok: true, data: { id: "post-1" } },
        "blocks-core.content.post-approve": { ok: true, data: { id: "post-1" } },
        "blocks-core.content.post-publish": { ok: true, data: { id: "post-2" } },
    },
}
