import { catalogCopy } from "./policies/catalog-copy.policy"
import type { ModuleGate } from "./modules.contracts"

/** The setup gates of the lead generation module: what it must know before it may act. */
export const LEAD_GEN_GATES: ReadonlyArray<ModuleGate> = [
    {
        key: "icp_area",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.icp_area.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.icp_area.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.icp_area.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.icp_area.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "customer",
                attributeLabel: catalogCopy("modulesCatalog.lead_gen.gates.icp_area.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
        ],
    },
    {
        key: "public_offers",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.public_offers.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.public_offers.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.public_offers.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.public_offers.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "product",
                attributeLabel: catalogCopy(
                    "modulesCatalog.lead_gen.gates.public_offers.writes.0.attributeLabel",
                    "vi",
                ),
                scope: "public",
            },
        ],
    },
    {
        key: "qualification",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.qualification.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.qualification.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.qualification.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.qualification.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: catalogCopy(
                    "modulesCatalog.lead_gen.gates.qualification.writes.0.attributeLabel",
                    "vi",
                ),
                scope: "internal",
            },
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: catalogCopy(
                    "modulesCatalog.lead_gen.gates.qualification.writes.1.attributeLabel",
                    "vi",
                ),
                scope: "internal",
            },
        ],
    },
    {
        key: "objections",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.objections.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.objections.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.objections.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.objections.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: catalogCopy("modulesCatalog.lead_gen.gates.objections.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
        ],
    },
    {
        key: "forbidden_claims",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.forbidden_claims.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.forbidden_claims.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.forbidden_claims.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.forbidden_claims.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: catalogCopy(
                    "modulesCatalog.lead_gen.gates.forbidden_claims.writes.0.attributeLabel",
                    "vi",
                ),
                scope: "restricted",
            },
        ],
    },
    {
        key: "hours_owner",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.hours_owner.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.hours_owner.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.hours_owner.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.hours_owner.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: catalogCopy("modulesCatalog.lead_gen.gates.hours_owner.writes.0.attributeLabel", "vi"),
                scope: "internal",
            },
            {
                kind: "rule",
                action: "handoff_to_sales",
                field: "mode",
            },
        ],
    },
    {
        key: "tone",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.tone.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.tone.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.tone.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.tone.hint", "en"),
        writes: [
            {
                kind: "fact",
                subjectType: "policy",
                attributeLabel: catalogCopy("modulesCatalog.lead_gen.gates.tone.writes.0.attributeLabel", "vi"),
                scope: "restricted",
            },
        ],
    },
    {
        key: "channels_posts",
        label_vi: catalogCopy("modulesCatalog.lead_gen.gates.channels_posts.label", "vi"),
        label_en: catalogCopy("modulesCatalog.lead_gen.gates.channels_posts.label", "en"),
        hint_vi: catalogCopy("modulesCatalog.lead_gen.gates.channels_posts.hint", "vi"),
        hint_en: catalogCopy("modulesCatalog.lead_gen.gates.channels_posts.hint", "en"),
    },
]
