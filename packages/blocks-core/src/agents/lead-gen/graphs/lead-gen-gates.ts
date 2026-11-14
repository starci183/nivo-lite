import type { ModuleTemplateGate } from "@nivo-lite/agent-sdk/module"
import { LEAD_GEN_COPY as copy } from "./copy"

/** The setup gates of the lead generation module: what it must know before it may act. */
export const LEAD_GEN_GATES: ReadonlyArray<ModuleTemplateGate> = [
    {
        key: "icp_area",
        label_vi: copy.one("gates.icp_area.label", "vi"),
        label_en: copy.one("gates.icp_area.label", "en"),
        hint_vi: copy.one("gates.icp_area.hint", "vi"),
        hint_en: copy.one("gates.icp_area.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "customer",
                attributeLabel: copy.one("gates.icp_area.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
        ],
    },
    {
        key: "public_offers",
        label_vi: copy.one("gates.public_offers.label", "vi"),
        label_en: copy.one("gates.public_offers.label", "en"),
        hint_vi: copy.one("gates.public_offers.hint", "vi"),
        hint_en: copy.one("gates.public_offers.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "product",
                attributeLabel: copy.one("gates.public_offers.writes.0.attributeLabel", "vi"),
                scope: "public",
            },
        ],
    },
    {
        key: "qualification",
        label_vi: copy.one("gates.qualification.label", "vi"),
        label_en: copy.one("gates.qualification.label", "en"),
        hint_vi: copy.one("gates.qualification.hint", "vi"),
        hint_en: copy.one("gates.qualification.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: copy.one("gates.qualification.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: copy.one("gates.qualification.writes.1.attributeLabel", "vi"),
                scope: "internal",
            },
        ],
    },
    {
        key: "objections",
        label_vi: copy.one("gates.objections.label", "vi"),
        label_en: copy.one("gates.objections.label", "en"),
        hint_vi: copy.one("gates.objections.hint", "vi"),
        hint_en: copy.one("gates.objections.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: copy.one("gates.objections.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
        ],
    },
    {
        key: "forbidden_claims",
        label_vi: copy.one("gates.forbidden_claims.label", "vi"),
        label_en: copy.one("gates.forbidden_claims.label", "en"),
        hint_vi: copy.one("gates.forbidden_claims.hint", "vi"),
        hint_en: copy.one("gates.forbidden_claims.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: copy.one("gates.forbidden_claims.writes.0.attributeLabel", "vi"),
                scope: "restricted",
            },
        ],
    },
    {
        key: "hours_owner",
        label_vi: copy.one("gates.hours_owner.label", "vi"),
        label_en: copy.one("gates.hours_owner.label", "en"),
        hint_vi: copy.one("gates.hours_owner.hint", "vi"),
        hint_en: copy.one("gates.hours_owner.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: copy.one("gates.hours_owner.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
        ],
    },
    {
        key: "tone",
        label_vi: copy.one("gates.tone.label", "vi"),
        label_en: copy.one("gates.tone.label", "en"),
        hint_vi: copy.one("gates.tone.hint", "vi"),
        hint_en: copy.one("gates.tone.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: copy.one("gates.tone.writes.0.attributeLabel", "vi"),
                scope: "restricted",
            },
        ],
    },
    {
        key: "channels_posts",
        label_vi: copy.one("gates.channels_posts.label", "vi"),
        label_en: copy.one("gates.channels_posts.label", "en"),
        hint_vi: copy.one("gates.channels_posts.hint", "vi"),
        hint_en: copy.one("gates.channels_posts.hint", "en"),
    },
]
