// The decision of the project check `engine-business-contracts` (ext/checks/engine-business-contracts.mjs, doc ext/docs/checks/engine-business-contracts.md),
// pure: a map of repo-relative path -> text and the two lists the concepts hold in, findings out. No file read, no build, no package loaded. This file is
// no check: it lives in ext/support/ because the harness's R103 refuses a file of ext/checks/ that ext/manifest.json `checks` does not declare.
// Concepts: .starciwork/concepts/layers.md (the generic service contracts the engine may look up) and providers.md (the allowed imports of a provider module).
//
// Everything is decided from what the code DECLARES and CALLS, read with the TypeScript compiler API; no name, word or pattern decides a meaning:
//  - a CONTRACT is a const initialised by a call of the imported `defineServiceContract`; its id is the string given to that call;
//  - an engine file REFERENCES a contract when one of its imports resolves, through the export chain (`export { a as b } from`, `export *`, an alias const,
//    an `import * as ns` and `ns.X`), to such a const;
//  - a PROVIDER MODULE is a folder of `be/src/modules/domain/` whose class registers itself or its own implementation in an injected registry at boot
//    (`onModuleInit() { this.<registry>.<call>(this | this.<own>) }`), which is how a provider offers itself (provider-registry.service.ts).
import { dirname, posix } from "node:path"
import ts from "typescript"
import { COMPOSITION_ROOTS, normalizePath } from "./engine-imports-rules.mjs"

export const SDK_SRC = "packages/agent-sdk/src/"
export const DOMAIN = "be/src/modules/domain/"
const SDK_PACKAGE = "@nivo-lite/agent-sdk"
const DEFINE = "defineServiceContract"
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/u
const SPEC_FILE = /\.(?:spec|test|integration-spec)\.[cm]?[jt]sx?$/u

// ---------------------------------------------------------------------------------------------------------------------------------
// Parsing

const kindOf = (file) => (/\.[jt]sx$/u.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/u.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS)

/** A parsed tree of the files, each parsed once. */
export const treeOf = (files) => {
    const sources = new Map()
    const source = (file) => {
        if (!sources.has(file)) {
            const text = files.get(file)
            sources.set(file, text === undefined ? null : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kindOf(file)))
        }
        return sources.get(file)
    }
    return { files, source }
}

const lineOf = (source, node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
const isStringLiteral = (node) => node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
const unwrap = (node) => {
    let current = node
    while (current !== undefined && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current)))
        current = current.expression
    return current
}
const hasModifier = (node, kind) => (ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind) : false)

/** The files a specifier can name, tried in order: a relative path, or the agent-sdk package and its subpaths (`<sub>/index.ts` beside the src folder). */
const candidatesOf = (from, specifier) => {
    let base
    if (/^\.\.?(?:\/|$)/u.test(specifier)) base = posix.normalize(posix.join(dirname(from), specifier))
    else if (specifier === SDK_PACKAGE) base = `${SDK_SRC}index`
    else if (specifier.startsWith(`${SDK_PACKAGE}/`)) base = `${SDK_SRC}${specifier.slice(SDK_PACKAGE.length + 1)}`
    else return []
    const bare = base.replace(/\.(?:[cm]?js|[jt]sx?)$/u, "")
    return [`${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`, `${bare}/index.tsx`, base]
}

/** The file a specifier of `from` resolves to inside `files`, or null (a package outside the tree, a path nobody wrote). */
export const resolveSpecifier = (tree, from, specifier) => candidatesOf(from, specifier).find((candidate) => tree.files.has(candidate)) ?? null

// ---------------------------------------------------------------------------------------------------------------------------------
// Contracts: declarations, the export chain, the bindings of a file

/** Is `callee` the imported `defineServiceContract` of this file (plain, aliased, or `ns.defineServiceContract` of a namespace import)? */
const definesContract = (source, callee) => {
    const imported = new Set()
    const namespaces = new Set()
    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || statement.importClause?.namedBindings === undefined) continue
        const bindings = statement.importClause.namedBindings
        if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
        else for (const element of bindings.elements) if ((element.propertyName ?? element.name).text === DEFINE) imported.add(element.name.text)
    }
    if (ts.isIdentifier(callee)) return imported.has(callee.text)
    return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && callee.name.text === DEFINE
}

/** `{ id, line }` when the node is a call of the imported `defineServiceContract` with a string id, else null. */
const contractCall = (source, node) => {
    const call = unwrap(node)
    if (call === undefined || !ts.isCallExpression(call) || !definesContract(source, call.expression)) return null
    return { id: isStringLiteral(call.arguments[0]) ? call.arguments[0].text : null, line: lineOf(source, call) }
}

/** Every call of the imported `defineServiceContract` in a file: `{ file, line, id, name }`, `name` being the const it is assigned to (or null). */
export const declarationsIn = (tree, file) => {
    const source = tree.source(file)
    if (source === null) return []
    const found = []
    const visit = (node) => {
        const call = ts.isCallExpression(node) ? contractCall(source, node) : null
        if (call !== null) {
            let owner = node.parent
            while (owner !== undefined && (ts.isParenthesizedExpression(owner) || ts.isAsExpression(owner) || ts.isSatisfiesExpression(owner))) owner = owner.parent
            const name = owner !== undefined && ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name) ? owner.name.text : null
            found.push({ file, line: call.line, id: call.id, name })
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return found
}

/**
 * The contract bindings of a file: local name -> `{ id, file, line }` for (a) a const initialised by a call of `defineServiceContract`, (b) a const that
 * aliases another binding, (c) a named import that resolves through the export chain to a contract. Memoised; a cycle yields what is known so far.
 */
const bindingsOf = (tree, file, cache = new Map()) => {
    if (cache.has(file)) return cache.get(file)
    const bindings = new Map()
    cache.set(file, bindings)
    const source = tree.source(file)
    if (source === null) return bindings
    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !isStringLiteral(statement.moduleSpecifier)) continue
        const target = resolveSpecifier(tree, file, statement.moduleSpecifier.text)
        const named = statement.importClause?.namedBindings
        if (target === null || named === undefined || !ts.isNamedImports(named)) continue
        const exported = exportedContracts(tree, target, cache)
        for (const element of named.elements) {
            const contract = exported.get((element.propertyName ?? element.name).text)
            if (contract !== undefined) bindings.set(element.name.text, contract)
        }
    }
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue
            const call = contractCall(source, declaration.initializer)
            if (call !== null) bindings.set(declaration.name.text, { id: call.id, file, line: call.line })
            else {
                const init = unwrap(declaration.initializer)
                if (ts.isIdentifier(init) && bindings.has(init.text)) bindings.set(declaration.name.text, bindings.get(init.text))
            }
        }
    }
    return bindings
}

const exportedCache = new WeakMap()

/** The contracts a file exports, by exported name, following `export { a as b }`, `export { a } from`, `export * from` and exported consts. */
export const exportedContracts = (tree, file, bindingCache = new Map()) => {
    let perTree = exportedCache.get(tree)
    if (perTree === undefined) exportedCache.set(tree, (perTree = new Map()))
    if (perTree.has(file)) return perTree.get(file)
    const exported = new Map()
    perTree.set(file, exported)
    const source = tree.source(file)
    if (source === null) return exported
    const bindings = bindingsOf(tree, file, bindingCache)
    for (const statement of source.statements) {
        if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
            for (const declaration of statement.declarationList.declarations)
                if (ts.isIdentifier(declaration.name) && bindings.has(declaration.name.text)) exported.set(declaration.name.text, bindings.get(declaration.name.text))
        } else if (ts.isExportDeclaration(statement)) {
            const target = statement.moduleSpecifier !== undefined && isStringLiteral(statement.moduleSpecifier) ? resolveSpecifier(tree, file, statement.moduleSpecifier.text) : null
            if (statement.moduleSpecifier === undefined) {
                if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause))
                    for (const element of statement.exportClause.elements) {
                        const contract = bindings.get((element.propertyName ?? element.name).text)
                        if (contract !== undefined) exported.set(element.name.text, contract)
                    }
            } else if (target !== null) {
                const there = exportedContracts(tree, target, bindingCache)
                if (statement.exportClause === undefined) for (const [name, contract] of there) exported.set(name, contract)
                else if (ts.isNamedExports(statement.exportClause))
                    for (const element of statement.exportClause.elements) {
                        const contract = there.get((element.propertyName ?? element.name).text)
                        if (contract !== undefined) exported.set(element.name.text, contract)
                    }
            }
        }
    }
    return exported
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Scopes

const inSdkSource = (file) => file.startsWith(SDK_SRC) && CODE_FILE.test(file)
const isFixtureFile = (file) => /\.fixture\.[cm]?[jt]sx?$/u.test(file) || /\/(?:tests?|fixtures?)\//u.test(file)
/** An agent-sdk file the law reads: source, not a spec, not a fixture. */
export const isSdkProduction = (file) => inSdkSource(file) && !SPEC_FILE.test(file) && !isFixtureFile(file)
/** An engine file whose references count: `be/` code that is no spec, no test-support file and no composition root. */
export const isEngineProduction = (file) =>
    file.startsWith("be/") && CODE_FILE.test(file) && !SPEC_FILE.test(file) && !file.startsWith("be/src/tests/") && !Object.hasOwn(COMPOSITION_ROOTS, file)
/** Test support of the engine (`be/src/tests/**`, no spec): reported apart, never counted. */
export const isEngineTestSupport = (file) => file.startsWith("be/src/tests/") && CODE_FILE.test(file) && !SPEC_FILE.test(file) && !Object.hasOwn(COMPOSITION_ROOTS, file)

// ---------------------------------------------------------------------------------------------------------------------------------
// Parts (a) and (c): contracts

/**
 * Declarations and references of contracts that are not on the generic list. `generic` is the Set of contract ids the concept lists.
 * Findings: `{ kind, file, line, contract, name?, uses? }` with kind
 *  - `sdk-declaration`   agent-sdk (production source) declares a contract whose id is off the list;
 *  - `engine-declaration` the engine declares one itself (a contract of the engine is a contract all the same);
 *  - `engine-reference`  an engine file imports, re-exports or reaches through a namespace a contract off the list;
 *  - `engine-id-literal` an engine file writes the id of a contract off the list as a string.
 * Test-support files of the engine give the same findings with kind `test-support-reference` (informational, the check does not count them).
 */
export const contractFindings = (tree, generic) => {
    const findings = []
    const paths = [...tree.files.keys()].filter((file) => CODE_FILE.test(file)).sort()
    const declared = []
    for (const file of paths) {
        const mine = isSdkProduction(file) || isEngineProduction(file)
        if (mine && tree.files.get(file).includes(DEFINE))
            for (const declaration of declarationsIn(tree, file)) {
                declared.push(declaration)
                if (declaration.id === null || !generic.has(declaration.id))
                    findings.push({
                        kind: file.startsWith("be/") ? "engine-declaration" : "sdk-declaration",
                        file,
                        line: declaration.line,
                        contract: declaration.id ?? "(no string id)",
                        name: declaration.name,
                    })
            }
    }
    // Every contract the tree declares, anywhere that is not a spec: the ids an engine string must not repeat.
    const offList = new Set()
    for (const file of paths) {
        if (SPEC_FILE.test(file) || !tree.files.get(file).includes(DEFINE)) continue
        for (const declaration of declarationsIn(tree, file)) if (declaration.id !== null && !generic.has(declaration.id)) offList.add(declaration.id)
    }
    // A file that exports a contract and is no agent-sdk file (a re-export of the engine's own) is a carrier: whoever names it is read too.
    const carriers = paths
        .filter((file) => !file.startsWith(SDK_SRC) && file.startsWith("be/") && (tree.files.get(file).includes("agent-sdk") || tree.files.get(file).includes(DEFINE)))
        .filter((file) => exportedContracts(tree, file).size > 0)
        .map((file) => posix.basename(file).replace(/.[^.]+$/u, ""))
    for (const file of paths) {
        const engine = isEngineProduction(file)
        if (!engine && !isEngineTestSupport(file)) continue
        const text = tree.files.get(file)
        if (!text.includes("agent-sdk") && !carriers.some((name) => text.includes(name)) && ![...offList].some((id) => text.includes(id))) continue
        const kind = engine ? "engine-reference" : "test-support-reference"
        const source = tree.source(file)
        const references = new Map()
        const add = (contract, line, local) => {
            if (contract.id === null || generic.has(contract.id)) return
            const key = `${contract.id}\0${local}`
            const entry = references.get(key) ?? { contract: contract.id, line, local, uses: [] }
            if (line !== entry.line) entry.uses.push(line)
            references.set(key, entry)
        }
        // Named imports and `export ... from`: the specifier's own line is the finding, the later uses of the local name are listed.
        const imported = new Map()
        for (const statement of source.statements) {
            if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || statement.moduleSpecifier === undefined || !isStringLiteral(statement.moduleSpecifier)) continue
            const target = resolveSpecifier(tree, file, statement.moduleSpecifier.text)
            if (target === null) continue
            const there = exportedContracts(tree, target)
            if (ts.isImportDeclaration(statement)) {
                const named = statement.importClause?.namedBindings
                if (named === undefined) continue
                if (ts.isNamespaceImport(named)) imported.set(named.name.text, there)
                else
                    for (const element of named.elements) {
                        const contract = there.get((element.propertyName ?? element.name).text)
                        if (contract !== undefined) {
                            add(contract, lineOf(source, element), element.name.text)
                            imported.set(`#${element.name.text}`, contract)
                        }
                    }
            } else if (statement.exportClause === undefined) {
                for (const [name, contract] of there) add(contract, lineOf(source, statement), `*${name}`)
            } else if (ts.isNamedExports(statement.exportClause)) {
                for (const element of statement.exportClause.elements) {
                    const contract = there.get((element.propertyName ?? element.name).text)
                    if (contract !== undefined) add(contract, lineOf(source, element), element.name.text)
                }
            }
        }
        const visit = (node) => {
            if (ts.isImportDeclaration(node)) return
            if (ts.isIdentifier(node) && imported.has(`#${node.text}`) && !ts.isImportSpecifier(node.parent) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node))
                add(imported.get(`#${node.text}`), lineOf(source, node), node.text)
            else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && imported.get(node.expression.text) instanceof Map) {
                const contract = imported.get(node.expression.text).get(node.name.text)
                if (contract !== undefined) add(contract, lineOf(source, node), `${node.expression.text}.${node.name.text}`)
            } else if (isStringLiteral(node) && offList.has(node.text) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent))
                findings.push({ kind: engine ? "engine-id-literal" : "test-support-id-literal", file, line: lineOf(source, node), contract: node.text })
            ts.forEachChild(node, visit)
        }
        visit(source)
        for (const entry of references.values())
            findings.push({
                kind,
                file,
                line: entry.line,
                contract: entry.contract,
                name: entry.local.replace(/^\*/u, ""),
                uses: [...new Set(entry.uses)].sort((a, b) => a - b),
            })
    }
    return { findings, declared }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Part (b): a domain module that exists only around a contract

/** The folder of `be/src/modules/domain/<folder>/...`, or null. */
export const domainFolderOf = (file) => (file.startsWith(DOMAIN) ? file.slice(DOMAIN.length).split("/")[0] : null)

const hasInjectableClass = (source) => {
    let found = false
    const visit = (node) => {
        if (ts.isClassDeclaration(node) && (ts.getDecorators(node) ?? []).length > 0) found = true
        if (!found) ts.forEachChild(node, visit)
    }
    visit(source)
    return found
}

/**
 * The domain folders in which every non-spec service file (a file declaring a decorated class) references a contract off the list, or imports (inside the
 * folder, transitively) a file that does. `references` are the `engine-reference` findings. Returns `{ folder, contracts, files }` per folder.
 */
export const aroundContract = (tree, references) => {
    const byFolder = new Map()
    for (const finding of references) {
        const folder = domainFolderOf(finding.file)
        if (folder === null) continue
        const entry = byFolder.get(folder) ?? { contracts: new Set(), touching: new Set() }
        entry.contracts.add(finding.contract)
        entry.touching.add(finding.file)
        byFolder.set(folder, entry)
    }
    const result = []
    for (const [folder, entry] of [...byFolder].sort(([a], [b]) => a.localeCompare(b))) {
        const members = [...tree.files.keys()].filter((file) => domainFolderOf(file) === folder && CODE_FILE.test(file) && !SPEC_FILE.test(file))
        const importsOf = new Map(members.map((file) => [file, relativeTargets(tree, file)]))
        let grew = true
        while (grew) {
            grew = false
            for (const file of members)
                if (!entry.touching.has(file) && importsOf.get(file).some((target) => entry.touching.has(target))) {
                    entry.touching.add(file)
                    grew = true
                }
        }
        const services = members.filter((file) => hasInjectableClass(tree.source(file)))
        if (services.length > 0 && services.every((file) => entry.touching.has(file))) result.push({ folder, contracts: [...entry.contracts].sort(), files: services })
    }
    return result
}

const relativeTargets = (tree, file) => {
    const source = tree.source(file)
    const targets = []
    for (const statement of source.statements)
        if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier !== undefined && isStringLiteral(statement.moduleSpecifier)) {
            const target = /^\./u.test(statement.moduleSpecifier.text) ? resolveSpecifier(tree, file, statement.moduleSpecifier.text) : null
            if (target !== null) targets.push(target)
        }
    return targets
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Part (C): provider modules and what they import

/** The member names a class declares as methods. */
const methodNames = (node) => new Set(node.members.filter((member) => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)).map((member) => member.name.text))

/**
 * The provider registries: the classes of the domain pieces that declare the registry API (`register(port)` and `of(provider)`: the abstract
 * `ProviderRegistryService` and the compose registry that has the same shape), and every class that extends one. Returns the Set of those class names (a heritage names its base by identifier; the base is told by its declared shape, not by its name).
 */
const registryClasses = (tree) => {
    const classes = []
    for (const file of tree.files.keys()) {
        if (domainFolderOf(file) === null || !CODE_FILE.test(file) || SPEC_FILE.test(file)) continue
        const text = tree.files.get(file)
        if (!text.includes("class ")) continue
        const visit = (node) => {
            if (ts.isClassDeclaration(node) && node.name !== undefined) classes.push(node)
            ts.forEachChild(node, visit)
        }
        visit(tree.source(file))
    }
    const bases = new Set(
        classes.filter((node) => ["register", "of"].every((name) => methodNames(node).has(name))).map((node) => node.name.text),
    )
    const heritageOf = (node) =>
        (node.heritageClauses ?? [])
            .filter((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
            .flatMap((clause) => clause.types.map((type) => (ts.isIdentifier(type.expression) ? type.expression.text : null)))
    const registries = new Set(bases)
    for (const node of classes) if (heritageOf(node).some((name) => bases.has(name))) registries.add(node.name.text)
    return registries
}

/** The names of the members of a class (constructor parameter properties and fields) whose declared type is one of `typeNames`. */
const membersTyped = (node, typeNames) => {
    const typed = new Set()
    const typeName = (type) => (type !== undefined && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) ? type.typeName.text : null)
    for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && typeNames.has(typeName(member.type))) typed.add(member.name.text)
        if (ts.isConstructorDeclaration(member))
            for (const parameter of member.parameters)
                if (ts.isIdentifier(parameter.name) && (ts.getModifiers(parameter) ?? []).length > 0 && typeNames.has(typeName(parameter.type))) typed.add(parameter.name.text)
    }
    return typed
}

/**
 * The provider modules: `Map<folder, { file, line }>`, the first registration site of each. A folder of `be/src/modules/domain/` is one when a non-spec class of
 * it has an `onModuleInit` that calls a method of a member typed with a provider registry (`this.registry.register(this.compose)`): the module offers its
 * implementation to the provider registry once at boot (provider-registry.service.ts: "A provider module registers its implementation once at boot").
 */
export const providerModules = (tree) => {
    const registries = registryClasses(tree)
    const providers = new Map()
    for (const file of [...tree.files.keys()].sort()) {
        const folder = domainFolderOf(file)
        if (folder === null || providers.has(folder) || !CODE_FILE.test(file) || SPEC_FILE.test(file) || !tree.files.get(file).includes("onModuleInit")) continue
        const source = tree.source(file)
        const visit = (node) => {
            if (ts.isClassDeclaration(node)) {
                const members = membersTyped(node, registries)
                const hook = node.members.find((member) => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "onModuleInit")
                if (members.size > 0 && hook?.body !== undefined) {
                    const walk = (inner) => {
                        if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && isThisMember(inner.expression.expression) && members.has(inner.expression.expression.name.text) && !providers.has(folder))
                            providers.set(folder, { file, line: lineOf(source, inner) })
                        ts.forEachChild(inner, walk)
                    }
                    walk(hook.body)
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(source)
    }
    return providers
}
const isThisMember = (node) => ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword

/** The domain folder a specifier of `file` names (`@modules/domain/<f>[/...]` or a relative path into `be/src/modules/domain/<f>/`), or null. */
const domainTarget = (file, specifier) => {
    const alias = /^@modules\/domain\/([^/]+)(?:\/|$)/u.exec(specifier)
    if (alias !== null) return alias[1]
    if (!/^\.\.?(?:\/|$)/u.test(specifier)) return null
    return domainFolderOf(`${posix.normalize(posix.join(dirname(file), specifier))}/`)
}

/** Every import of a file as `{ specifier, line, typeOnly }` (static import and export-from, `import()`, `require()`); `typeOnly` when every name is `type`. */
const importsOf = (source) => {
    const found = []
    const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined && isStringLiteral(node.moduleSpecifier)) {
            let typeOnly = false
            if (ts.isImportDeclaration(node) && node.importClause !== undefined) {
                const clause = node.importClause
                const named = clause.namedBindings
                typeOnly = clause.isTypeOnly || (clause.name === undefined && named !== undefined && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly))
            } else if (ts.isExportDeclaration(node)) {
                const clause = node.exportClause
                typeOnly = node.isTypeOnly || (clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly))
            }
            found.push({ specifier: node.moduleSpecifier.text, line: lineOf(source, node.moduleSpecifier), typeOnly })
        } else if (ts.isCallExpression(node) && isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")))
            found.push({ specifier: node.arguments[0].text, line: lineOf(source, node.arguments[0]), typeOnly: false })
        ts.forEachChild(node, visit)
    }
    visit(source)
    return found
}

/**
 * The imports of a provider module's non-spec files that reach another domain piece outside the allowed set. `allowed` is a Map<piece, "any" | "type-only">
 * read from providers.md. Another provider module and the module's own folder are always allowed. Findings `{ file, line, folder, piece, form }`.
 */
export const providerImportFindings = (tree, providers, allowed) => {
    const findings = []
    for (const file of [...tree.files.keys()].sort()) {
        const folder = domainFolderOf(file)
        if (folder === null || !providers.has(folder) || !CODE_FILE.test(file) || SPEC_FILE.test(file)) continue
        for (const { specifier, line, typeOnly } of importsOf(tree.source(file))) {
            const piece = domainTarget(file, specifier)
            if (piece === null || piece === folder || providers.has(piece)) continue
            const form = allowed.get(piece)
            if (form === "any" || (form === "type-only" && typeOnly)) continue
            findings.push({ file, line, folder, piece, form: form === "type-only" ? "value import of a type-only piece" : "not allowed" })
        }
    }
    return findings
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The two lists the concepts hold

/** The rows of the first markdown table after the heading whose text contains `title`: arrays of trimmed cells, header and rule rows left out. */
const tableAfter = (markdown, title) => {
    const lines = markdown.split(/\r?\n/u)
    const start = lines.findIndex((line) => /^#{1,6}\s/u.test(line) && line.includes(title))
    if (start === -1) return null
    const rows = []
    let inTable = false
    for (const line of lines.slice(start + 1)) {
        if (/^\s*\|/u.test(line)) {
            inTable = true
            rows.push(line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim()))
        } else if (inTable) break
        else if (/^#{1,6}\s/u.test(line)) break
    }
    return rows.filter((cells, index) => index > 0 && !cells.every((cell) => /^:?-+:?$/u.test(cell)))
}
const codeOf = (cell) => /^`([^`]+)`$/u.exec(cell)?.[1] ?? null

/** The title the generic-contract table sits under in layers.md. */
export const GENERIC_TITLE = "Generic service contracts the engine may look up"
/** The title the allowed-imports table sits under in providers.md. */
export const ALLOWED_TITLE = "Allowed imports of a provider module"

/** The generic contract ids of layers.md: `{ ids: Set, errors: string[] }`. A table row is `| \`id\` | why generic for every agent |`; a row with no reason is an error. */
export const genericContracts = (layersText) => {
    const rows = tableAfter(layersText, GENERIC_TITLE)
    if (rows === null) return { ids: new Set(), errors: [`layers.md has no section titled "${GENERIC_TITLE}" with its table`] }
    const ids = new Set()
    const errors = []
    for (const cells of rows) {
        const id = codeOf(cells[0] ?? "")
        if (id === null) continue
        if ((cells[1] ?? "") === "") errors.push(`generic contract ${id} has no reason`)
        ids.add(id)
    }
    return { ids, errors }
}

/** The allowed imports of providers.md: `{ allowed: Map<piece, "any" | "type-only">, errors }`. A row is `| \`piece\` | any or type-only | reason |`. */
export const allowedProviderImports = (providersText) => {
    const rows = tableAfter(providersText, ALLOWED_TITLE)
    if (rows === null) return { allowed: new Map(), errors: [`providers.md has no section titled "${ALLOWED_TITLE}" with its table`] }
    const allowed = new Map()
    const errors = []
    for (const cells of rows) {
        const piece = codeOf(cells[0] ?? "")
        if (piece === null) continue
        const form = (cells[1] ?? "").replace(/`/gu, "")
        if (form !== "any" && form !== "type-only") errors.push(`allowed import ${piece}: form must be "any" or "type-only", not "${form}"`)
        else if ((cells[2] ?? "") === "") errors.push(`allowed import ${piece} has no reason`)
        else allowed.set(piece, form)
    }
    return { allowed, errors }
}

/** The lines of a finding, for the report. */
export const findingLine = (finding) => {
    const where = `${finding.file}:${finding.line}`
    switch (finding.kind) {
        case "sdk-declaration":
            return `${where}  agent-sdk declares contract ${finding.contract}${finding.name === null ? "" : ` as ${finding.name}`}, not on the generic list`
        case "engine-declaration":
            return `${where}  the engine declares contract ${finding.contract}${finding.name === null ? "" : ` as ${finding.name}`}, not on the generic list`
        case "engine-reference":
        case "test-support-reference":
            return `${where}  references contract ${finding.contract} (${finding.name}${finding.uses.length > 0 ? `; also at line ${finding.uses.join(", ")}` : ""}), not on the generic list`
        case "engine-id-literal":
        case "test-support-id-literal":
            return `${where}  writes the id of contract ${finding.contract} as a string`
        default:
            return `${where}  ${finding.kind}`
    }
}

/** One line per provider import finding. */
export const providerFindingLine = (finding) =>
    `${finding.file}:${finding.line}  provider module ${finding.folder} imports ${finding.piece} (${finding.form})`

// ---------------------------------------------------------------------------------------------------------------------------------
// Part (D): the one event pipeline (.starciwork/concepts/triggers.md rule 13). Three structural laws, each read from declarations and imports:
//  (D1) a PROVIDER TRIGGER DECLARATION is pure: a file of `be/src` (no spec, no test support) that declares a member `translate` (a property, method or
//       shorthand of an object literal, or a class member) imports VALUES only from files of its own domain folder and the schema libraries of the triggers
//       concept's table; a type-only import (the declaration contract, SDK types) is free, since a type can read or write nothing;
//  (D2) ONE DELIVERY FUNCTION: the files of `be/src` (no spec, no test support) that import the wake writer class (through any re-export chain) are the
//       writer's own domain folder and the callers the triggers concept lists; any other is a finding;
//  (D3) the TRIGGER SCOPE declares no member outside the generic list: every `{ name: "<member>" }` of a const typed with `SuppliedParam`, or of a
//       `supplies` array, in the scope files the concept lists, is on the concept's list.

/** The file a specifier names: a relative path, `@modules/<...>` (be/src/modules/<...>) or the agent-sdk package; null for any other package. */
const resolveAny = (tree, from, specifier) => {
    const alias = /^@modules\/(.+)$/u.exec(specifier)
    if (alias === null) return resolveSpecifier(tree, from, specifier)
    const base = `be/src/modules/${alias[1]}`
    return [`${base}.ts`, `${base}/index.ts`, base].find((candidate) => tree.files.has(candidate)) ?? null
}

/** The member names an object literal declares (properties, methods, shorthands). */
const literalMembers = (node) =>
    new Set(node.properties.flatMap((property) => (property.name !== undefined && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? [property.name.text] : [])))

/**
 * The line of the first trigger DECLARATION a file makes, or null: an object literal that declares `translate` together with `verb` and `raw` (the shape of a
 * trigger declaration, read from the members it declares, never from a name of the file or the const).
 */
const translateLine = (source) => {
    let found = null
    const visit = (node) => {
        if (found !== null) return
        if (ts.isObjectLiteralExpression(node) && ["translate", "verb", "raw"].every((member) => literalMembers(node).has(member))) {
            const member = node.properties.find((property) => property.name !== undefined && ts.isIdentifier(property.name) && property.name.text === "translate")
            found = lineOf(source, member ?? node)
        } else ts.forEachChild(node, visit)
    }
    visit(source)
    return found
}

/** The package a specifier names (`zod`, `@nivo-lite/agent-sdk`), or null for a path or an alias of the tree. */
const packageOf = (specifier) => {
    if (/^\.\.?(?:\/|$)/u.test(specifier) || specifier.startsWith("@modules/") || specifier.startsWith("@tests/")) return null
    const parts = specifier.split("/")
    return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

const isEngineSource = (file) => file.startsWith("be/src/") && !file.startsWith("be/src/tests/") && CODE_FILE.test(file) && !SPEC_FILE.test(file)

/**
 * (D1) The imports of every provider trigger declaration file that reach outside its own domain folder, a listed schema library, or agent-sdk as types.
 * `schemaLibraries` is a Set of package names. Findings `{ part: "translate", file, line, specifier, why, declaredAt }`.
 */
export const translateFindings = (tree, schemaLibraries) => {
    const findings = []
    for (const file of [...tree.files.keys()].sort()) {
        if (!isEngineSource(file) || !tree.files.get(file).includes("translate")) continue
        const source = tree.source(file)
        const declaredAt = translateLine(source)
        if (declaredAt === null) continue
        const own = domainFolderOf(file)
        const push = (line, specifier, why) => findings.push({ part: "translate", file, line, specifier, why, declaredAt })
        for (const { specifier, line, typeOnly } of importsOf(source)) {
            // A type carries no behaviour: a type-only import (the declaration's own contract, SDK types) can read or write nothing.
            if (typeOnly) continue
            const pkg = packageOf(specifier)
            if (schemaLibraries.has(specifier) || (pkg !== null && pkg === specifier && schemaLibraries.has(pkg))) continue
            if (pkg !== null) push(line, specifier, pkg === SDK_PACKAGE ? "a value import of agent-sdk outside the listed entries (only its types)" : "a package that is not on the list")
            else {
                const target = resolveAny(tree, file, specifier)
                const folder = target === null ? domainTarget(file, specifier) : domainFolderOf(target)
                if (own === null || folder !== own) push(line, specifier, "outside the provider's own folder")
            }
        }
    }
    return findings
}

/** The classes a file exports, exported name -> origin `file#Class`, through `export { a as b } from`, `export * from`, imports re-exported and exported declarations. */
const classesCache = new WeakMap()
const exportedClasses = (tree, file) => {
    let cache = classesCache.get(tree)
    if (cache === undefined) classesCache.set(tree, (cache = new Map()))
    if (cache.has(file)) return cache.get(file)
    // Set before reading: a cycle sees what is known so far (memoised once per file).
    const exported = new Map()
    cache.set(file, exported)
    const source = tree.source(file)
    if (source === null) return exported
    const local = new Map()
    for (const statement of source.statements) {
        if (ts.isClassDeclaration(statement) && statement.name !== undefined) {
            local.set(statement.name.text, `${file}#${statement.name.text}`)
            if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) exported.set(statement.name.text, `${file}#${statement.name.text}`)
        }
        const named = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined
        if (named === undefined || !ts.isNamedImports(named) || !isStringLiteral(statement.moduleSpecifier)) continue
        const target = resolveAny(tree, file, statement.moduleSpecifier.text)
        if (target === null) continue
        const there = exportedClasses(tree, target)
        for (const element of named.elements) {
            const origin = there.get((element.propertyName ?? element.name).text)
            if (origin !== undefined) local.set(element.name.text, origin)
        }
    }
    for (const statement of source.statements) {
        if (!ts.isExportDeclaration(statement)) continue
        if (statement.moduleSpecifier === undefined) {
            if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause))
                for (const element of statement.exportClause.elements) {
                    const origin = local.get((element.propertyName ?? element.name).text)
                    if (origin !== undefined) exported.set(element.name.text, origin)
                }
            continue
        }
        if (!isStringLiteral(statement.moduleSpecifier)) continue
        const target = resolveAny(tree, file, statement.moduleSpecifier.text)
        if (target === null) continue
        const there = exportedClasses(tree, target)
        if (statement.exportClause === undefined) for (const [name, origin] of there) exported.set(name, origin)
        else if (ts.isNamedExports(statement.exportClause))
            for (const element of statement.exportClause.elements) {
                const origin = there.get((element.propertyName ?? element.name).text)
                if (origin !== undefined) exported.set(element.name.text, origin)
            }
    }
    return exported
}

/**
 * (D2) The files that import a wake writer (`writers` = a Set of `file#Class`, the concept's rows of kind `writer`: the wake door and every door of the same
 * folder that writes through it) and are neither in a writer's own domain folder nor on the list of delivery callers (a Set of repo paths). Findings
 * `{ part: "delivery", file, line, name }`.
 */
export const deliveryFindings = (tree, writers, callers) => {
    const findings = []
    const writerFolders = new Set([...writers].map((writer) => domainFolderOf(writer.split("#")[0])))
    for (const file of [...tree.files.keys()].sort()) {
        if (!isEngineSource(file) || writerFolders.has(domainFolderOf(file)) || callers.has(file)) continue
        const source = tree.source(file)
        for (const statement of source.statements) {
            const named = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined
            if (named === undefined || !ts.isNamedImports(named) || !isStringLiteral(statement.moduleSpecifier)) continue
            const target = resolveAny(tree, file, statement.moduleSpecifier.text)
            if (target === null) continue
            const there = exportedClasses(tree, target)
            for (const element of named.elements)
                if (writers.has(there.get((element.propertyName ?? element.name).text))) findings.push({ part: "delivery", file, line: lineOf(source, element), name: element.name.text })
        }
    }
    return findings
}

/** The `name` strings of the object literals of an array literal, or of the const array an identifier names earlier in the same file. */
const memberNamesOf = (source, node, consts) => {
    const array = unwrap(node)
    if (array === undefined) return []
    if (ts.isIdentifier(array)) return consts.get(array.text) ?? []
    if (!ts.isArrayLiteralExpression(array)) return []
    return array.elements.flatMap((element) => {
        const one = unwrap(element)
        if (one === undefined || !ts.isObjectLiteralExpression(one)) return []
        const name = one.properties.find((property) => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === "name")
        return name !== undefined && isStringLiteral(name.initializer) ? [{ member: name.initializer.text, line: lineOf(source, name) }] : []
    })
}

/**
 * (D3) The supplied members the scope files declare that are off the generic list: the elements of every const whose declared type names `SuppliedParam`
 * and of every `supplies` array literal. Findings `{ part: "scope", file, line, member }`, one per declaration site.
 */
export const scopeFindings = (tree, scopeFiles, generic) => {
    const findings = []
    for (const file of scopeFiles) {
        const source = tree.source(file)
        if (source === null || source === undefined) {
            findings.push({ part: "scope", file, line: 0, member: "(scope file missing)" })
            continue
        }
        const consts = new Map()
        const sites = []
        const visit = (node) => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && node.type !== undefined && node.type.getText(source).includes("SuppliedParam")) {
                const names = memberNamesOf(source, node.initializer, consts)
                consts.set(node.name.text, names)
                sites.push(...names)
            } else if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "supplies" && ts.isArrayLiteralExpression(unwrap(node.initializer)))
                sites.push(...memberNamesOf(source, node.initializer, consts))
            ts.forEachChild(node, visit)
        }
        visit(source)
        const seen = new Set()
        for (const site of sites) {
            const key = `${site.member}:${site.line}`
            if (generic.has(site.member) || seen.has(key)) continue
            seen.add(key)
            findings.push({ part: "scope", file, line: site.line, member: site.member })
        }
    }
    return findings
}

/** The titles of the triggers concept's three tables. */
export const PIPELINE_TITLES = {
    scope: "Generic members of the trigger scope",
    delivery: "Delivery callers of the wake writer",
    schema: "Schema libraries a provider trigger declaration may import",
}

/**
 * The three lists of triggers.md. Rows are `| \`value\` | kind | reason |`: the scope table's kinds are `member` and `file` (a file the scope is read
 * from), the delivery table's `writer` (at least one, `file#Class`) and `caller`; the schema table is `| \`package\` | reason |`. A row without a reason is
 * an error. Returns `{ scope: Set, scopeFiles, writers: Set, callers: Set, schema: Set, errors }`.
 */
export const pipelineLists = (triggersText) => {
    const errors = []
    const read = (title, withKind) => {
        const rows = tableAfter(triggersText, title)
        if (rows === null) {
            errors.push(`triggers.md has no section titled "${title}" with its table`)
            return []
        }
        return rows.flatMap((cells) => {
            const value = codeOf(cells[0] ?? "")
            if (value === null) return []
            const kind = withKind ? (cells[1] ?? "").replace(/`/gu, "") : ""
            const reason = cells[withKind ? 2 : 1] ?? ""
            if (reason === "") errors.push(`${title}: ${value} has no reason`)
            return [{ value, kind }]
        })
    }
    const scopeRows = read(PIPELINE_TITLES.scope, true)
    const deliveryRows = read(PIPELINE_TITLES.delivery, true)
    const schemaRows = read(PIPELINE_TITLES.schema, false)
    for (const row of scopeRows) if (row.kind !== "member" && row.kind !== "file") errors.push(`${PIPELINE_TITLES.scope}: ${row.value} kind must be "member" or "file"`)
    for (const row of deliveryRows) if (row.kind !== "writer" && row.kind !== "caller") errors.push(`${PIPELINE_TITLES.delivery}: ${row.value} kind must be "writer" or "caller"`)
    const writers = deliveryRows.filter((row) => row.kind === "writer")
    if (deliveryRows.length > 0 && writers.length === 0) errors.push(`${PIPELINE_TITLES.delivery}: no row of kind "writer" (file#Class)`)
    for (const row of writers) if (!row.value.includes("#")) errors.push(`${PIPELINE_TITLES.delivery}: writer ${row.value} is not file#Class`)
    return {
        scope: new Set(scopeRows.filter((row) => row.kind === "member").map((row) => row.value)),
        scopeFiles: scopeRows.filter((row) => row.kind === "file").map((row) => row.value),
        writers: new Set(writers.map((row) => row.value)),
        callers: new Set(deliveryRows.filter((row) => row.kind === "caller").map((row) => row.value)),
        schema: new Set(schemaRows.map((row) => row.value)),
        errors,
    }
}

/** One line per pipeline finding. */
export const pipelineFindingLine = (finding) => {
    if (finding.part === "translate")
        return `${finding.file}:${finding.line}  provider trigger declaration (translate at line ${finding.declaredAt}) imports ${finding.specifier}: ${finding.why}`
    if (finding.part === "delivery") return `${finding.file}:${finding.line}  imports the wake writer (${finding.name}) outside the one delivery function and its listed callers`
    return `${finding.file}:${finding.line}  the trigger scope declares member ${finding.member}, not on the generic list`
}
