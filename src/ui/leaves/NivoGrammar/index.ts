"use client"

import {
    COMMON_GRAMMAR_COMPONENTS,
    COMMON_UI_RULE_IDS,
    defineGrammarRuleConformance,
    type GrammarComponentRenderer,
    type GrammarRootProps,
} from "@starci/grammar/common"
import { createElement } from "react"

/**
 * NIVO IS ITS OWN GRAMMAR FAMILY, AND THAT IS THE WHOLE POINT OF THIS FILE.
 *
 * nivo used to mount StarCi's Core family. Core's stylesheet binds `--accent` to
 * `--starci-core-accent` (StarCi purple) under `.grammar-common-root[data-grammar-family="core"]`,
 * and that selector outranks any `:root` an app writes, so nivo's unicorn red only survived where
 * the app re-declared it again - inside the console boundary. Every surface outside that boundary,
 * the sign-in page included, painted StarCi purple: the checkbox, the focus rings, the primary
 * button. A product with its own palette is not a consumer of another product's family; it is its
 * own family over the same Common contract, and another family never imports Core.
 *
 * WHY THIS DOES NOT CALL `defineGrammarFamily`.
 *
 * Common exports that helper and it is the right shape, but its `styles.entrypoint` is typed as
 * `` `@starci/grammar/${string}/styles.css` `` - it can only describe a family that ships inside the
 * Grammar package. nivo's stylesheet ships from `@nivo/ui`, so the helper cannot state where this
 * family's CSS lives without a cast that would make the declaration a lie. The small pattern is
 * replicated instead, over the same `COMMON_GRAMMAR_COMPONENTS` and the same `GrammarRoot`, so the
 * only difference from Core is the family id and the location of the stylesheet.
 */

/** The one attribute value that scopes every nivo value in the sibling `nivo.css`. */
export const NIVO_GRAMMAR_FAMILY_ID = "nivo"

/** Where the family's own values live, and the attribute that scopes them. */
export type NivoGrammarFamilyStyles = {
    readonly entrypoint: "@nivo/ui/family.css"
    readonly scope: { readonly attribute: "data-grammar-family"; readonly value: typeof NIVO_GRAMMAR_FAMILY_ID }
}

/** One visual family over the stable Common semantic contract, shipped outside the Grammar package. */
export type NivoGrammarFamily = {
    readonly id: typeof NIVO_GRAMMAR_FAMILY_ID
    readonly familyId: typeof NIVO_GRAMMAR_FAMILY_ID
    readonly styles: NivoGrammarFamilyStyles
    readonly components: Omit<typeof COMMON_GRAMMAR_COMPONENTS, "GrammarRoot"> & {
        readonly GrammarRoot: GrammarComponentRenderer<GrammarRootProps>
    }
    readonly scopeProps: { readonly "data-grammar-family": typeof NIVO_GRAMMAR_FAMILY_ID }
}

/** Common's own root, stamped with the family attribute the nivo stylesheet keys off. */
const NivoGrammarRootRenderer: GrammarComponentRenderer<GrammarRootProps> = (props) =>
    createElement(COMMON_GRAMMAR_COMPONENTS.GrammarRoot, {
        ...props,
        "data-grammar-family": NIVO_GRAMMAR_FAMILY_ID,
    })

/** The nivo family: every Common renderer, with Common's root replaced by the scoped one. */
export const NIVO_GRAMMAR: NivoGrammarFamily = {
    id: NIVO_GRAMMAR_FAMILY_ID,
    familyId: NIVO_GRAMMAR_FAMILY_ID,
    styles: {
        entrypoint: "@nivo/ui/family.css",
        scope: { attribute: "data-grammar-family", value: NIVO_GRAMMAR_FAMILY_ID },
    },
    components: { ...COMMON_GRAMMAR_COMPONENTS, GrammarRoot: NivoGrammarRootRenderer },
    scopeProps: { "data-grammar-family": NIVO_GRAMMAR_FAMILY_ID },
}

/** Selects the nivo family for everything it wraps. One per app, at the provider boundary. */
export const NivoGrammarRoot = NIVO_GRAMMAR.components.GrammarRoot

/** nivo inherits every Common rule and publishes no family-specific evidence of its own yet. */
export const nivoRuleConformance = defineGrammarRuleConformance({
    familyId: NIVO_GRAMMAR_FAMILY_ID,
    inheritedCommonRules: COMMON_UI_RULE_IDS,
    familyEvidence: {},
})
