// The decision of the project check `engine-imports` (ext/support/engine-imports-rules.mjs) on fixtures.
import { strict as assert } from "node:assert"
import { test } from "node:test"
import { COMPOSITION_ROOTS, countsByFolder, countsByPackage, engineImportFindings, findingLine, folderOf } from "../support/engine-imports-rules.mjs"

const ENGINE = "be/src/modules/domain/chat/chat.service.ts"
const BE_ROOT = "be/src/modules/domain/installed-plugins/installed.policy.ts"
const BE_TEST_ROOT = "be/src/tests/fixtures/builders/installation-parts.builder.ts"
const FE_ROOT = "fe/apps/web/src/modules/plugin-registry/index.ts"
const FE_CLIENT_ROOT = "fe/apps/web/src/modules/plugin-registry/client.ts"
const FE_FILE = "fe/apps/web/src/hooks/teamChat/useTeamChat.ts"
const packagesOf = (file, text) => engineImportFindings(file, text).map((finding) => `${finding.line}:${finding.package}`)

test("every import form of a forbidden package is a finding, with its line", () => {
    const text = [
        `import { a } from "@nivo-lite/blocks-core"`,
        `import type { B } from "@nivo-lite/blocks-core"`,
        `export { c } from "@nivo-lite/nivo-web-core"`,
        `export * from "@nivo-lite/nivo-web-core"`,
        `import d = require("@nivo-lite/blocks-core")`,
        `const e = await import("@nivo-lite/blocks-core")`,
        `const f = require("@nivo-lite/nivo-web-core")`,
        `type G = import("@nivo-lite/blocks-core").H`,
        `import "@nivo-lite/blocks-core"`,
        `jest.mock("@nivo-lite/blocks-core", () => ({}))`,
        `jest.requireActual("@nivo-lite/nivo-web-core")`,
    ].join("\n")
    assert.deepEqual(packagesOf(ENGINE, text), [
        "1:@nivo-lite/blocks-core",
        "2:@nivo-lite/blocks-core",
        "3:@nivo-lite/nivo-web-core",
        "4:@nivo-lite/nivo-web-core",
        "5:@nivo-lite/blocks-core",
        "6:@nivo-lite/blocks-core",
        "7:@nivo-lite/nivo-web-core",
        "8:@nivo-lite/blocks-core",
        "9:@nivo-lite/blocks-core",
        "10:@nivo-lite/blocks-core",
        "11:@nivo-lite/nivo-web-core",
    ])
})

test("a subpath of a forbidden package is a finding, a package that only shares the prefix is not", () => {
    assert.deepEqual(packagesOf(ENGINE, `import { x } from "@nivo-lite/blocks-core/client"`), ["1:@nivo-lite/blocks-core"])
    assert.deepEqual(packagesOf(ENGINE, `import { x } from "@nivo-lite/nivo-web-core/rules/sales"`), ["1:@nivo-lite/nivo-web-core"])
    assert.deepEqual(packagesOf(ENGINE, `import { x } from "@nivo-lite/blocks-core-extra"`), [])
    assert.deepEqual(packagesOf(ENGINE, `import { x } from "@nivo-lite/agent-sdk/installation"`), [])
})

test("a relative reach into the package folder is the same dependency", () => {
    assert.deepEqual(packagesOf(ENGINE, `import { x } from "../../../../packages/blocks-core/src/index"`), ["1:@nivo-lite/blocks-core"])
})

test("a comment or a string that mentions the package is no import", () => {
    const text = [
        `// import { a } from "@nivo-lite/blocks-core"`,
        `/* const b = require("@nivo-lite/nivo-web-core") */`,
        `/** @see @nivo-lite/blocks-core */`,
        "const message = 'import x from \"@nivo-lite/blocks-core\"'",
        "const template = `require(\"@nivo-lite/nivo-web-core\")`",
        `const name = "@nivo-lite/blocks-core"`,
        `const mod = load("@nivo-lite/blocks-core")`,
    ].join("\n")
    assert.deepEqual(packagesOf(ENGINE, text), [])
})

test("the composition roots are listed in one constant: path to the packages it may import", () => {
    assert.deepEqual(COMPOSITION_ROOTS, {
        [BE_ROOT]: ["@nivo-lite/plugin-registry"],
        [BE_TEST_ROOT]: ["@nivo-lite/plugin-registry"],
        [FE_ROOT]: ["@nivo-lite/plugin-registry"],
        [FE_CLIENT_ROOT]: ["@nivo-lite/plugin-registry"],
    })
})

test("the plugin registry is allowed at the composition roots only", () => {
    const text = `import { INSTALLED } from "@nivo-lite/plugin-registry"\nimport { blocks } from "@nivo-lite/plugin-registry/client"`
    const both = ["1:@nivo-lite/plugin-registry", "2:@nivo-lite/plugin-registry"]
    for (const root of [BE_ROOT, BE_TEST_ROOT, FE_ROOT]) assert.deepEqual(packagesOf(root, text), [], root)
    assert.deepEqual(packagesOf(ENGINE, text), both)
    assert.deepEqual(packagesOf("be/src/modules/domain/installed-plugins/installed-steps.policy.ts", text), both)
    assert.deepEqual(packagesOf(FE_FILE, text), both)
    // A root of one place is no root of another.
    assert.deepEqual(packagesOf("be/src/modules/plugin-registry/index.ts", text), both)
    assert.deepEqual(packagesOf("fe/apps/admin/src/modules/plugin-registry/index.ts", text), both)
})

test("a root imports no business package either: the roots hold the registry only", () => {
    for (const root of [BE_ROOT, BE_TEST_ROOT, FE_ROOT]) {
        assert.deepEqual(packagesOf(root, `import { x } from "@nivo-lite/blocks-core"`), ["1:@nivo-lite/blocks-core"], root)
        assert.deepEqual(packagesOf(root, `import { x } from "@nivo-lite/nivo-web-core/client"`), ["1:@nivo-lite/nivo-web-core"], root)
    }
})

test("a spec's jest.mock of the registry replaces the root's input and is no finding; requireActual outside the roots is", () => {
    const mocked = [
        `jest.mock("@nivo-lite/plugin-registry", () => ({ installed: {} }))`,
        `jest.mock("@nivo-lite/plugin-registry")`,
        `jest.doMock("@nivo-lite/plugin-registry", () => ({}))`,
        `jest.unmock("@nivo-lite/plugin-registry")`,
    ].join("\n")
    assert.deepEqual(packagesOf("be/src/tests/engine-threads/wait.spec.ts", mocked), [])
    assert.deepEqual(packagesOf("be/src/modules/domain/x/x.spec.ts", mocked), [])
    const actual = [
        `const a = jest.requireActual("@nivo-lite/plugin-registry")`,
        `import { installed } from "@nivo-lite/plugin-registry"`,
        `const b = require("@nivo-lite/plugin-registry")`,
        `const c = jest.requireMock("@nivo-lite/plugin-registry")`,
    ].join("\n")
    assert.deepEqual(packagesOf("be/src/tests/engine-threads/wait.spec.ts", actual), [
        "1:@nivo-lite/plugin-registry",
        "2:@nivo-lite/plugin-registry",
        "3:@nivo-lite/plugin-registry",
        "4:@nivo-lite/plugin-registry",
    ])
    // The test root may call requireActual: it is where the real installation is read for the specs.
    assert.deepEqual(packagesOf(BE_TEST_ROOT, `const a = jest.requireActual("@nivo-lite/plugin-registry")`), [])
    // A mock never excuses a business package: mocking blocks-core still binds it by name.
    assert.deepEqual(packagesOf("be/src/x.spec.ts", `jest.mock("@nivo-lite/blocks-core", () => ({}))`), ["1:@nivo-lite/blocks-core"])
})

test("the front end imports no business package and no registry outside its root, in any app or package", () => {
    const text = [
        `import { a } from "@nivo-lite/blocks-core/graph"`,
        `import { b } from "@nivo-lite/blocks-core/client"`,
        `import json from "@nivo-lite/blocks-core/messages/en.json"`,
        `import { c } from "@nivo-lite/nivo-web-core"`,
        `import { d } from "@nivo-lite/plugin-registry/client"`,
        `import { e } from "@nivo-lite/agent-sdk/team-chat"`,
        `import { f } from "@/modules/plugin-registry"`,
    ].join("\n")
    const expected = [
        "1:@nivo-lite/blocks-core",
        "2:@nivo-lite/blocks-core",
        "3:@nivo-lite/blocks-core",
        "4:@nivo-lite/nivo-web-core",
        "5:@nivo-lite/plugin-registry",
    ]
    assert.deepEqual(packagesOf(FE_FILE, text), expected)
    assert.deepEqual(packagesOf("fe/apps/landing/src/app/page.tsx", text), expected)
    assert.deepEqual(packagesOf("fe/packages/nivo-i18n/src/index.ts", text), expected)
    assert.deepEqual(packagesOf(FE_ROOT, text), expected.slice(0, 4))
    // Only the sources of an app or a package are read: its config files and the folders outside `src` are not.
    assert.deepEqual(packagesOf("fe/apps/web/next.config.mjs", text), [])
    assert.deepEqual(packagesOf("fe/apps/web/e2e/x.ts", text), [])
})

test("a spec file and an app of be are checked like prod code", () => {
    const text = `import { INSTALLED } from "@nivo-lite/plugin-registry/client"`
    assert.deepEqual(packagesOf("be/src/tests/engine-threads/wait.spec.ts", text), ["1:@nivo-lite/plugin-registry"])
    assert.deepEqual(packagesOf("be/apps/api/src/compose/modules.ts", text), ["1:@nivo-lite/plugin-registry"])
    assert.deepEqual(packagesOf("be/src/x.spec.ts", `import { x } from "@nivo-lite/blocks-core"`), ["1:@nivo-lite/blocks-core"])
})

test("agent-sdk imports none of blocks-core, nivo-web-core, plugin-registry", () => {
    const file = "packages/agent-sdk/src/installation/define.ts"
    const text = [
        `import a from "@nivo-lite/blocks-core"`,
        `import b from "@nivo-lite/nivo-web-core/x"`,
        `import c from "@nivo-lite/plugin-registry"`,
        `import d from "node:path"`,
    ].join("\n")
    assert.deepEqual(packagesOf(file, text), ["1:@nivo-lite/blocks-core", "2:@nivo-lite/nivo-web-core", "3:@nivo-lite/plugin-registry"])
})

test("files outside the law and non-code files are not read", () => {
    const text = `import a from "@nivo-lite/blocks-core"`
    assert.deepEqual(packagesOf("packages/blocks-core/src/index.ts", text), [])
    assert.deepEqual(packagesOf("packages/plugin-registry/src/installed.ts", text), [])
    assert.deepEqual(packagesOf("fe/src/app.tsx", text), [])
    assert.deepEqual(packagesOf("packages/agent-sdk/test/x.ts", text), [])
    assert.deepEqual(packagesOf("be/contracts/x.json", text), [])
    assert.deepEqual(packagesOf("be/README.md", text), [])
})

test("Windows and POSIX paths are the same file", () => {
    const text = `import { INSTALLED } from "@nivo-lite/plugin-registry"`
    assert.deepEqual(packagesOf("be\\src\\modules\\domain\\installed-plugins\\installed.policy.ts", text), [])
    assert.deepEqual(packagesOf("fe\\apps\\web\\src\\modules\\plugin-registry\\index.ts", text), [])
    assert.deepEqual(packagesOf("fe\\apps\\web\\src\\x.ts", text), ["1:@nivo-lite/plugin-registry"])
    assert.deepEqual(packagesOf(".\\be\\src\\x.ts", text), ["1:@nivo-lite/plugin-registry"])
    assert.deepEqual(packagesOf("./be/src/x.ts", text), ["1:@nivo-lite/plugin-registry"])
    assert.deepEqual(packagesOf("packages\\agent-sdk\\src\\x.ts", text), ["1:@nivo-lite/plugin-registry"])
})

test("a tsx and a js file are parsed", () => {
    assert.deepEqual(packagesOf("be/src/a.tsx", `const v = <div>{require("@nivo-lite/blocks-core")}</div>`), ["1:@nivo-lite/blocks-core"])
    assert.deepEqual(packagesOf("be/scripts/a.mjs", `import x from "@nivo-lite/blocks-core"`), ["1:@nivo-lite/blocks-core"])
})

test("a finding prints as file:line  package and counts per folder and per package", () => {
    const findings = [
        ...engineImportFindings("be/src/a.ts", `import a from "@nivo-lite/blocks-core"`),
        ...engineImportFindings("be\\src\\b.ts", `\nimport a from "@nivo-lite/nivo-web-core"`),
        ...engineImportFindings("packages/agent-sdk/src/c.ts", `import a from "@nivo-lite/plugin-registry"`),
        ...engineImportFindings("fe/apps/web/src/d.ts", `import a from "@nivo-lite/blocks-core/graph"`),
        ...engineImportFindings("fe/packages/nivo-i18n/src/e.ts", `import a from "@nivo-lite/blocks-core"`),
    ]
    assert.deepEqual(findings.map(findingLine), [
        "be/src/a.ts:1  @nivo-lite/blocks-core",
        "be/src/b.ts:2  @nivo-lite/nivo-web-core",
        "packages/agent-sdk/src/c.ts:1  @nivo-lite/plugin-registry",
        "fe/apps/web/src/d.ts:1  @nivo-lite/blocks-core",
        "fe/packages/nivo-i18n/src/e.ts:1  @nivo-lite/blocks-core",
    ])
    assert.deepEqual(countsByFolder(findings), { be: 2, "packages/agent-sdk": 1, "fe/apps/web": 1, "fe/packages/nivo-i18n": 1 })
    assert.deepEqual(countsByPackage(findings), {
        "@nivo-lite/blocks-core": 3,
        "@nivo-lite/nivo-web-core": 1,
        "@nivo-lite/plugin-registry": 1,
    })
})

test("a folder is told by its path; outside the law there is none", () => {
    assert.equal(folderOf("be\\src\\x.ts"), "be")
    assert.equal(folderOf("fe/apps/admin/src/x.ts"), "fe/apps/admin")
    assert.equal(folderOf("fe/packages/nivo-offer/src/x.ts"), "fe/packages/nivo-offer")
    assert.equal(folderOf("packages/agent-sdk/src/x.ts"), "packages/agent-sdk")
    assert.equal(folderOf("packages/blocks-core/src/x.ts"), null)
})
