import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the content codes and the notices the content automations write, Vietnamese and English. */
export const CONTENT_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTENT_NOT_WRITTEN": "Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c b\u00e0i \u0111\u0103ng.",
        "content.channel.facebook": "Facebook",
        "content.channel.zalo": "Zalo OA",
        "content.channel.tiktok": "TikTok",
        "content.channel.instagram": "Instagram",
        "content.status.idea": "m\u1edbi l\u00e0 \u00fd t\u01b0\u1edfng",
        "content.status.draft": "b\u1ea3n nh\u00e1p, ch\u01b0a g\u1eedi duy\u1ec7t",
        "content.status.waiting_approval": "\u0111ang ch\u1edd b\u1ea1n duy\u1ec7t",
        "content.status.approved": "\u0111\u00e3 duy\u1ec7t, s\u1eb5n s\u00e0ng \u0111\u0103ng",
        "content.status.published": "\u0111\u00e3 \u0111\u0103ng",
        "content.status.skipped": "\u0111\u00e3 b\u1ecf qua",
        "content.reminder.body":
            "H\u00f4m nay c\u00f3 {{count}} b\u00e0i c\u1ea7n \u0111\u0103ng:\n{{lines}}\n{{tail}}",
        "content.reminder.line": "- {{time}} {{channels}}: {{title}} ({{status}})",
        "content.reminder.notReady":
            "{{count}} b\u00e0i ch\u01b0a \u0111\u01b0\u1ee3c duy\u1ec7t. M\u1edf N\u1ed9i dung \u0111\u1ec3 so\u1ea1n v\u00e0 duy\u1ec7t tr\u01b0\u1edbc gi\u1edd \u0111\u0103ng.",
        "content.reminder.allReady":
            "T\u1ea5t c\u1ea3 \u0111\u00e3 duy\u1ec7t. M\u1edf N\u1ed9i dung \u0111\u1ec3 sao ch\u00e9p v\u00e0 \u0111\u0103ng.",
        "content.reminder.evidence": "Nh\u1eafc l\u1ecbch \u0111\u0103ng b\u00e0i h\u00f4m nay: {{count}} b\u00e0i",
        "content.summary.body":
            "T\u1ed5ng k\u1ebft n\u1ed9i dung tu\u1ea7n qua: {{total}} b\u00e0i l\u00ean l\u1ecbch, {{published}} \u0111\u00e3 \u0111\u0103ng, {{missed}} ch\u01b0a \u0111\u0103ng, {{skipped}} b\u1ecf qua.",
        "content.summary.pillars": "Theo ch\u1ee7 \u0111\u1ec1: {{pillars}}.",
        "content.summary.missed":
            "C\u00f2n b\u00e0i ch\u01b0a \u0111\u0103ng: ki\u1ec3m tra l\u1ea1i l\u1ecbch v\u00e0 \u0111\u0103ng ho\u1eb7c b\u1ecf qua.",
        "content.summary.empty":
            "T\u1ed5ng k\u1ebft n\u1ed9i dung tu\u1ea7n qua: kh\u00f4ng c\u00f3 b\u00e0i n\u00e0o l\u00ean l\u1ecbch. M\u1edf N\u1ed9i dung v\u00e0 b\u1ea5m L\u00ean k\u1ebf ho\u1ea1ch th\u00e1ng \u0111\u1ec3 c\u00f3 \u00fd t\u01b0\u1edfng cho tu\u1ea7n n\u00e0y.",
        "content.summary.evidence": "T\u1ed5ng k\u1ebft n\u1ed9i dung tu\u1ea7n: {{count}} b\u00e0i",
        "content.offer.title": "B\u00e0i v\u1ec1: {{title}}",
        "content.offer.brief":
            'C\u00f3 th\u00f4ng tin m\u1edbi trong tri th\u1ee9c: "{{title}}". Vi\u1ebft b\u00e0i gi\u1edbi thi\u1ec7u \u0111\u00fang nh\u1eefng g\u00ec ngu\u1ed3n n\u00e0y n\u00f3i, kh\u00f4ng th\u00eam \u01b0u \u0111\u00e3i n\u00e0o kh\u00e1c.',
        "content.offer.evidence": "T\u1ef1 so\u1ea1n v\u00ec c\u00f3 ngu\u1ed3n m\u1edbi: {{title}}.",
        "content.offer.notice":
            "C\u00f3 {{count}} \u00fd t\u01b0\u1edfng b\u00e0i m\u1edbi t\u1eeb \u01b0u \u0111\u00e3i v\u1eeba th\u00eam. M\u1edf N\u1ed9i dung \u0111\u1ec3 so\u1ea1n b\u00e0i v\u00e0 g\u1eedi duy\u1ec7t.",
        "content.offer.pattern":
            "\u01b0u \u0111\u00e3i|khuy\u1ebfn m\u00e3i|gi\u1ea3m gi\u00e1|combo|g\u00f3i |t\u1eb7ng |mi\u1ec5n ph\u00ed|khai tr\u01b0\u01a1ng|s\u1ef1 ki\u1ec7n|promo|offer|sale",
        "content.offer.pillar": "\u01b0u \u0111\u00e3i|khuy\u1ebfn m\u00e3i|offer|promo",
    },
    en: {
        "errors.CONTENT_NOT_WRITTEN": "The post was not saved.",
        "content.channel.facebook": "Facebook",
        "content.channel.zalo": "Zalo OA",
        "content.channel.tiktok": "TikTok",
        "content.channel.instagram": "Instagram",
        "content.status.idea": "only an idea",
        "content.status.draft": "a draft, not sent for approval",
        "content.status.waiting_approval": "waiting for your approval",
        "content.status.approved": "approved, ready to post",
        "content.status.published": "posted",
        "content.status.skipped": "skipped",
        "content.reminder.body": "{{count}} posts are due today:\n{{lines}}\n{{tail}}",
        "content.reminder.line": "- {{time}} {{channels}}: {{title}} ({{status}})",
        "content.reminder.notReady":
            "{{count}} posts are not approved yet. Open Content to write and approve them before posting time.",
        "content.reminder.allReady": "Everything is approved. Open Content to copy and post.",
        "content.reminder.evidence": "Reminder of today's posting schedule: {{count}} posts",
        "content.summary.body":
            "Content summary of last week: {{total}} posts scheduled, {{published}} posted, {{missed}} not posted, {{skipped}} skipped.",
        "content.summary.pillars": "By theme: {{pillars}}.",
        "content.summary.missed": "Some posts are still not posted: check the calendar and post or skip them.",
        "content.summary.empty":
            "Content summary of last week: no post was scheduled. Open Content and press Plan the month to get ideas for this week.",
        "content.summary.evidence": "Weekly content summary: {{count}} posts",
        "content.offer.title": "Post about: {{title}}",
        "content.offer.brief":
            'There is new information in the knowledge: "{{title}}". Write a post that says exactly what this source says and adds no other offer.',
        "content.offer.evidence": "Created automatically because of a new source: {{title}}.",
        "content.offer.notice":
            "{{count}} new post ideas came from the offers just added. Open Content to write them and send them for approval.",
        "content.offer.pattern": "offer|promotion|discount|combo|package |gift |free|opening|event|promo|sale",
        "content.offer.pillar": "offer|promotion|promo",
    },
}
