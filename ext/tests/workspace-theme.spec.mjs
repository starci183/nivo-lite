// The default of the workspace theme equals brand.css (.starciwork/concepts/theme.md rule 1), and the derivation's other laws, run against the
// real `fe/apps/web/src/modules/brand/theme.policy.ts` (transpiled here: fe has no test runner of its own).
import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import ts from "typescript"

const BRAND = new URL("../../fe/apps/web/src/modules/brand/", import.meta.url)
const read = (name) => readFileSync(new URL(name, BRAND), "utf8")

/** Loads the two pure modules as CommonJS, the types first (the policy requires them by their relative name). */
const loadPolicy = () => {
    const compile = (name) =>
        ts.transpileModule(read(name), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const run = (code, resolve) => {
        const exports = {}
        new Function("exports", "require", code)(exports, resolve)
        return exports
    }
    const types = run(compile("theme.types.ts"), () => ({}))
    return run(compile("theme.policy.ts"), (id) => {
        assert.equal(id, "./theme.types")
        return types
    })
}

const policy = loadPolicy()
const css = read("brand.css")

/** The declarations of the first block of brand.css that opens with `selector`, as `--name` to value. */
const blockOf = (selector) => {
    const open = css.indexOf("{", css.indexOf(selector))
    const body = css.slice(open + 1, css.indexOf("\n}", open))
    return Object.fromEntries([...body.matchAll(/^\s*(--[a-z-]+):\s*([^;]+);/gmu)].map((match) => [match[1], match[2].trim()]))
}

test("the default parameters give exactly the light tokens brand.css writes", () => {
    const light = blockOf(":root,")
    const derived = policy.deriveTheme(policy.DEFAULT_THEME)
    for (const [name, value] of Object.entries(derived.light)) assert.equal(light[name], value, name)
    assert.ok(Object.keys(derived.light).length >= 24)
})

test("the default parameters give exactly the dark tokens brand.css writes", () => {
    const dark = blockOf(".dark {")
    const derived = policy.deriveTheme(policy.DEFAULT_THEME)
    for (const [name, value] of Object.entries(derived.dark)) assert.equal(dark[name], value, name)
    assert.deepEqual(Object.keys(derived.dark), Object.keys(derived.light))
})

test("the default radius gives the two variables brand.css writes", () => {
    const light = blockOf(":root,")
    assert.deepEqual(policy.deriveTheme(policy.DEFAULT_THEME).radius, {
        "--radius": light["--radius"],
        "--field-radius": light["--field-radius"],
    })
})

test("the text on the accent is chosen by contrast: light on a deep accent, dark on a pale one", () => {
    const deep = policy.deriveTheme(policy.DEFAULT_THEME).light["--accent-foreground"]
    const pale = policy.deriveTheme({ ...policy.DEFAULT_THEME, hue: 100, chroma: 0.18, lightness: 0.9 }).light["--accent-foreground"]
    assert.match(deep, /^oklch\(99\.11% 0 0\)$/u)
    assert.match(pale, /^oklch\(21\.03% 0\.0068 /u)
})

test("the base leans the neutrals to the hue, and not at all at zero; the hue moves every token", () => {
    const at = (over) => policy.deriveTheme({ ...policy.DEFAULT_THEME, ...over }).light
    assert.equal(at({ base: 0 })["--background"], "oklch(97.02% 0 0)")
    assert.equal(at({ base: 1 })["--background"], "oklch(97.02% 0.0136 17.59)")
    assert.equal(at({ hue: 250 })["--surface"], "oklch(100% 0.0034 250)")
    assert.deepEqual(Object.keys(at({ hue: 250 })).filter((name) => /danger|success|warning|info/u.test(name)), [])
})

test("the radius steps, the font and the stylesheet", () => {
    const at = (over) => policy.deriveTheme({ ...policy.DEFAULT_THEME, ...over })
    assert.deepEqual(at({ radius: "square" }).radius, { "--radius": "0", "--field-radius": "0" })
    assert.equal(at({ radius: "large" }).radius["--radius"], "0.75rem")
    assert.equal(at({}).fontHref, null)
    assert.match(at({ font: "be-vietnam-pro" }).fontFamily, /^"Be Vietnam Pro"/u)
    assert.match(at({ font: "lexend" }).fontHref, /family=Lexend/u)
    const sheet = policy.themeStyleSheet(policy.DEFAULT_THEME)
    assert.ok(sheet.startsWith(":root,.light{") && sheet.includes(".dark{") && !sheet.includes("--font-sans"))
    assert.match(policy.themeStyleSheet({ ...policy.DEFAULT_THEME, font: "nunito" }), /body\[class\]\{--font-sans:"Nunito"/u)
    assert.match(policy.themeScopeSheet(policy.DEFAULT_THEME, "dark", ".x"), /^\.x\.x\{--radius:/u)
})

test("hex and oklch convert both ways and a text that is no hex is refused", () => {
    const oklch = policy.hexToOklch("#e8284a")
    assert.equal(policy.oklchToHex(oklch.lightness, oklch.chroma, oklch.hue), "#e8284a")
    assert.equal(policy.hexToOklch("crimson"), null)
    assert.ok(Math.abs(policy.hexToOklch("#fff").lightness - 0.95) < 0.01)
})
