// Acceptance of the agent template marketplace flow, in the style of the Nivo A-E kit (codex-resume-uat-local-v3/acceptance.mjs).
// Execute only through `starci uat run` against the one-command local stack: the harness hands STARCI_UAT_EVIDENCE and keeps the receipt.
// It reads the stack from the environment by name and never prints a credential:
//   NIVO_UAT_BASE            the web origin (for the optional page smoke)
//   NIVO_UAT_QUERY_URL       the GraphQL endpoint of the API
//   NIVO_UAT_AUTH_URL        the login endpoint (default: /auth/login on the origin of the query url)
//   NIVO_UAT_CREATOR_USER / NIVO_UAT_CREATOR_PASS   a disposable creator account that owns a workspace with a published agent graph
//   NIVO_UAT_ADMIN_USER   / NIVO_UAT_ADMIN_PASS     a disposable account listed as a platform admin
//   NIVO_UAT_BUYER_USER   / NIVO_UAT_BUYER_PASS     a disposable account that owns a second workspace (the buyer)
//   NIVO_UAT_FIXTURE         JSON {creatorWorkspaceId, creatorAgentId, creatorGraphV2VersionId, buyerWorkspaceId}
//                            creatorGraphV2VersionId is a second published version of the creator graph that adds or changes a branch.
// Flow: creator packages v1 -> submits -> admin approves -> buyer installs with parameters (shadow) -> buyer owner turns the graph on
// -> buyer edits a branch -> creator packages and lists v2 -> buyer accepts the update per branch, keeping the edited branch.
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const output = process.env.STARCI_UAT_EVIDENCE
if (!output) throw new Error("STARCI_UAT_RUN_REQUIRED")
mkdirSync(output, { recursive: true })
for (const name of ["NIVO_UAT_QUERY_URL", "NIVO_UAT_FIXTURE"]) {
    if (!process.env[name]) throw new Error("DECLARED_LOCAL_INGRESS_REQUIRED")
}
const queryUrl = new URL(process.env.NIVO_UAT_QUERY_URL)
const authUrl = new URL(process.env.NIVO_UAT_AUTH_URL ?? "/auth/login", queryUrl.origin)
const isLoopback = (hostname) => /^(?:127\.0\.0\.1|localhost|[a-z0-9-]+\.localhost)$/u.test(hostname)
if (!isLoopback(queryUrl.hostname) || !isLoopback(authUrl.hostname)) throw new Error("WITNESS_MUST_BE_LOCAL")
const fixture = JSON.parse(process.env.NIVO_UAT_FIXTURE)
const startedAt = new Date().toISOString()
const steps = []
const failures = []
const proof = []
const digest = (value) => createHash("sha256").update(value).digest("hex")
const need = (condition, code) => {
    if (!condition) throw new Error(code)
}
const KEY = `uat-spa-${Date.now().toString(36)}`
const FLOWS = ["package", "review", "install", "update"]
const completed = new Set()
let order = 0
let currentFlow = "preflight"

const save = () => {
    const verdict =
        failures.length === 0 &&
        steps.length > 0 &&
        steps.every((step) => step.status === "passed") &&
        completed.size === FLOWS.length
            ? "passed"
            : "failed"
    writeFileSync(join(output, "checks.json"), JSON.stringify({ verdict, steps }, null, 2))
    writeFileSync(join(output, "failures.json"), JSON.stringify(failures, null, 2))
    writeFileSync(
        join(output, "run.json"),
        JSON.stringify(
            {
                schema: "nivo/marketplace-acceptance@1",
                startedAt,
                finishedAt: new Date().toISOString(),
                key: KEY,
                proof,
                verdict,
            },
            null,
            2,
        ),
    )
    writeFileSync(
        join(output, "report.md"),
        [
            "# Agent marketplace acceptance",
            "",
            `Template key: ${KEY}. Flows: ${FLOWS.join(", ")}.`,
            "",
            ...steps.map((s) => `- ${s.order}. ${s.id}: ${s.status}${s.reason ? ` (${s.reason})` : ""}`),
            "",
            "Only the disposable accounts and the template key above are touched. No cleanup deletes run automatically.",
        ].join("\n"),
    )
}

/** One GraphQL call as one account in one workspace; a refusal of the server is returned as `errors`, never thrown. */
const call = async (who, workspaceId, document, variables = {}) => {
    const response = await fetch(queryUrl.href, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${who.token}`,
            ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
        },
        body: JSON.stringify({ query: document, variables }),
    })
    need(response.ok, "WITNESS_UNAVAILABLE")
    const result = await response.json()
    proof.push({
        source: who.name,
        digest: digest(JSON.stringify(result.data ?? result.errors ?? null)),
        workspaceId: workspaceId ?? null,
    })
    return result
}
const ok = async (who, workspaceId, document, variables) => {
    const result = await call(who, workspaceId, document, variables)
    need(result.data && !result.errors?.length, "OPERATION_REFUSED")
    return result.data
}

const login = async (name, userEnv, passEnv) => {
    need(process.env[userEnv] && process.env[passEnv], "NAMED_DISPOSABLE_LOGIN_REQUIRED")
    const response = await fetch(authUrl.href, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: process.env[userEnv], password: process.env[passEnv] }),
    })
    need(response.ok, "LOGIN_REFUSED")
    const grant = await response.json()
    need(
        typeof grant.accessToken === "string" && grant.accessToken.length > 0,
        "OWN_SUCCESSFUL_DISPOSABLE_LOGIN_REQUIRED",
    )
    return { name, token: grant.accessToken, userId: grant.user?.id }
}

const step = async (name, fn) => {
    const number = ++order
    const id = `${currentFlow}-${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/-$/u, "")}`
    let checks = {}
    let reason
    try {
        const result = await fn()
        need(result !== null && typeof result === "object", "EMPTY_ASSERTION_RESULT")
        checks = result.checks ?? {}
        need(
            Object.keys(checks).length > 0 && Object.values(checks).every((value) => typeof value === "boolean"),
            "EMPTY_OR_NONBOOLEAN_CHECKS",
        )
        need(
            Object.values(checks).every((value) => value === true),
            "CHECK_FAILED",
        )
    } catch (error) {
        reason = /^[A-Z0-9_]+$/u.test(error?.message ?? "") ? error.message : "SCRIPT_FAILURE"
    }
    steps.push({ order: number, id, status: reason ? "failed" : "passed", checks, ...(reason ? { reason } : {}) })
    if (reason) failures.push({ id, code: reason, failedChecks: Object.keys(checks).filter((key) => !checks[key]) })
    save()
    need(!reason, reason ?? "STEP_FAILED")
}

const PACKAGE_INPUT = (agentId, graphVersionId, version) => ({
    agentId,
    graphVersionId,
    key: KEY,
    name: { vi: "Dat lich spa", en: "Spa booking" },
    summary: { vi: "Quy trinh dat lich", en: "A booking process" },
    category: "operations",
    parameters: [],
    bindings: [],
    starterDocumentIds: [],
    soul: "Friendly and short.",
    changelog: `UAT version ${version}`,
    breaking: false,
})
const PACKAGE = `mutation($input: PackageAgentTemplateInput!) { packageAgentTemplate(input: $input) { id key version hash } }`
const PREVIEW = `query($input: PackageAgentTemplateInput!) { agentTemplatePreview(input: $input) { problems report { brainRefs privateSources people rights } package { key version hash parameters { key } } suggestions { parameter target nodeKey branchKey termIndex } } }`
const SUBMIT = `mutation($input: SubmitTemplateListingInput!) { submitTemplateListing(input: $input) { id status priceVnd checks { id ok } } }`
const REVIEW = `mutation($input: ReviewTemplateListingInput!) { reviewTemplateListing(input: $input) { id status } }`
const QUEUE = `query { templateReviewQueue { id templateKey version status } }`
const CATALOGUE = `query { marketplaceListings { id templateKey version priceVnd parameters { key defaultValue } } }`
const INSTALL = `mutation($input: InstallTemplateListingInput!) { installTemplateListing(input: $input) { installationId agentId key version licenseId } }`
const GRAPH = `query($input: GetAgentGraphInput!) { getAgentGraph(input: $input) { agentId mode draftRev draftJson } }`
const MODE = `mutation($input: SetAgentGraphModeInput!) { setAgentGraphMode(input: $input) }`
const SAVE = `mutation($input: SaveAgentGraphDraftInput!) { saveAgentGraphDraft(input: $input) }`
const PUBLISH = `mutation($input: PublishAgentGraphInput!) { publishAgentGraph(input: $input) { id version changeKind } }`
const OFFERS = `query { templateUpdateOffers { installationId key installed offered breaking units { id nodeKey branchKey change } } }`
const ACCEPT = `mutation($input: AcceptTemplateUpdateInput!) { acceptTemplateUpdate(input: $input) { installationId installed offered units { id } } }`
const VERSIONS = `query($input: ListAgentGraphVersionsInput!) { listAgentGraphVersions(input: $input) { id version } }`

const state = {}

try {
    const creator = await login("creator", "NIVO_UAT_CREATOR_USER", "NIVO_UAT_CREATOR_PASS")
    const admin = await login("admin", "NIVO_UAT_ADMIN_USER", "NIVO_UAT_ADMIN_PASS")
    const buyer = await login("buyer", "NIVO_UAT_BUYER_USER", "NIVO_UAT_BUYER_PASS")
    const { creatorWorkspaceId, creatorAgentId, creatorGraphV2VersionId, buyerWorkspaceId } = fixture
    need(creatorWorkspaceId && creatorAgentId && creatorGraphV2VersionId && buyerWorkspaceId, "FIXTURE_INCOMPLETE")

    // ---------------------------------------------------------------- package
    currentFlow = "package"
    await step("preview keeps the process and leaves out the private parts", async () => {
        const versions = (await ok(creator, creatorWorkspaceId, VERSIONS, { input: { agentId: creatorAgentId } }))
            .listAgentGraphVersions
        const first = versions.reduce((best, v) => (v.version < best.version ? v : best))
        state.v1GraphVersionId = first.id
        const data = await ok(creator, creatorWorkspaceId, PREVIEW, {
            input: PACKAGE_INPUT(creatorAgentId, first.id, 1),
        })
        const preview = data.agentTemplatePreview
        return {
            checks: {
                noProblems: preview.problems.length === 0,
                packageProduced: preview.package?.key === KEY && preview.package?.version === 1,
                reportCountsPresent:
                    typeof preview.report.brainRefs === "number" && typeof preview.report.people === "number",
            },
            seen: JSON.stringify(preview.report),
        }
    })
    await step("package version 1 and refuse the key to another account", async () => {
        const packaged = (
            await ok(creator, creatorWorkspaceId, PACKAGE, {
                input: PACKAGE_INPUT(creatorAgentId, state.v1GraphVersionId, 1),
            })
        ).packageAgentTemplate
        const stolen = await call(buyer, buyerWorkspaceId, PACKAGE, {
            input: PACKAGE_INPUT(creatorAgentId, state.v1GraphVersionId, 1),
        })
        return {
            checks: {
                versionOne: packaged.version === 1,
                hashed: /^[0-9a-f]{64}$/u.test(packaged.hash),
                otherAccountRefused: Boolean(stolen.errors?.length),
            },
            seen: packaged.hash,
        }
    })
    completed.add("package")

    // ---------------------------------------------------------------- review
    currentFlow = "review"
    await step("submit the version and read its automated checks", async () => {
        const listing = (
            await ok(creator, creatorWorkspaceId, SUBMIT, { input: { templateKey: KEY, version: 1, priceVnd: 0 } })
        ).submitTemplateListing
        state.listing1 = listing.id
        return {
            checks: {
                submitted: listing.status === "submitted",
                everyCheckPassed: listing.checks.length > 0 && listing.checks.every((c) => c.ok),
            },
            seen: listing.status,
        }
    })
    await step("only a platform admin approves, and an approved listing reaches the catalogue", async () => {
        const asCreator = await call(creator, creatorWorkspaceId, REVIEW, {
            input: { listingId: state.listing1, decision: "approve", note: "self" },
        })
        const queue = (await ok(admin, null, QUEUE)).templateReviewQueue
        const approved = (
            await ok(admin, null, REVIEW, { input: { listingId: state.listing1, decision: "approve", note: "UAT" } })
        ).reviewTemplateListing
        const catalogue = (await ok(buyer, buyerWorkspaceId, CATALOGUE)).marketplaceListings
        return {
            checks: {
                creatorCannotApprove: Boolean(asCreator.errors?.length),
                queued: queue.some((l) => l.id === state.listing1),
                approved: approved.status === "approved",
                inCatalogue: catalogue.some((l) => l.id === state.listing1),
            },
            seen: approved.status,
        }
    })
    completed.add("review")

    // ---------------------------------------------------------------- install
    currentFlow = "install"
    await step("buyer installs with parameters, in shadow, with the data rights denied by default", async () => {
        const installed = (
            await ok(buyer, buyerWorkspaceId, INSTALL, {
                input: { listingId: state.listing1, values: {}, name: "UAT spa" },
            })
        ).installTemplateListing
        state.installation = installed
        const graph = (
            await ok(buyer, buyerWorkspaceId, GRAPH, { input: { agentId: installed.agentId, locale: "vi" } })
        ).getAgentGraph
        const document = JSON.parse(graph.draftJson)
        return {
            checks: {
                installedVersionOne: installed.version === 1,
                licenseRecorded: typeof installed.licenseId === "string",
                shadow: graph.mode === "shadow",
                noRightGranted: Array.isArray(document.rights) && document.rights.length === 0,
            },
            seen: graph.mode,
        }
    })
    await step("the owner of the buyer turns the graph on", async () => {
        const turned = (
            await ok(buyer, buyerWorkspaceId, MODE, {
                input: { agentId: state.installation.agentId, mode: "enforced" },
            })
        ).setAgentGraphMode
        const graph = (
            await ok(buyer, buyerWorkspaceId, GRAPH, { input: { agentId: state.installation.agentId, locale: "vi" } })
        ).getAgentGraph
        return { checks: { turned: turned === true, enforced: graph.mode === "enforced" }, seen: graph.mode }
    })
    await step("the buyer edits one branch and publishes it", async () => {
        const graph = (
            await ok(buyer, buyerWorkspaceId, GRAPH, { input: { agentId: state.installation.agentId, locale: "vi" } })
        ).getAgentGraph
        const document = JSON.parse(graph.draftJson)
        const decide = document.nodes.find((node) => node.decide)
        need(decide, "NO_DECIDE_NODE")
        const branch = decide.decide.branches[0]
        state.editedBranch = { node: decide.key, branch: branch.key }
        decide.decide.branches[0] = { ...branch, selfCorrected: true }
        await ok(buyer, buyerWorkspaceId, SAVE, {
            input: { agentId: state.installation.agentId, documentJson: JSON.stringify(document), rev: graph.draftRev },
        })
        const published = (
            await ok(buyer, buyerWorkspaceId, PUBLISH, {
                input: { agentId: state.installation.agentId, note: "UAT edit" },
            })
        ).publishAgentGraph
        return {
            checks: { published: published.version > 1 },
            seen: `${state.editedBranch.node}/${state.editedBranch.branch}`,
        }
    })
    completed.add("install")

    // ---------------------------------------------------------------- update
    currentFlow = "update"
    await step("the creator packages and lists version 2, and the admin approves it", async () => {
        const packaged = (
            await ok(creator, creatorWorkspaceId, PACKAGE, {
                input: PACKAGE_INPUT(creatorAgentId, creatorGraphV2VersionId, 2),
            })
        ).packageAgentTemplate
        const listing = (
            await ok(creator, creatorWorkspaceId, SUBMIT, { input: { templateKey: KEY, version: 2, priceVnd: 0 } })
        ).submitTemplateListing
        const approved = (
            await ok(admin, null, REVIEW, { input: { listingId: listing.id, decision: "approve", note: "UAT v2" } })
        ).reviewTemplateListing
        return {
            checks: { versionTwo: packaged.version === 2, approved: approved.status === "approved" },
            seen: approved.status,
        }
    })
    await step("the buyer sees the update by branch and takes it, keeping the edited branch", async () => {
        const offers = (await ok(buyer, buyerWorkspaceId, OFFERS)).templateUpdateOffers
        const offer = offers.find((entry) => entry.installationId === state.installation.installationId)
        need(offer, "NO_OFFER")
        const edited = offer.units.find(
            (unit) => unit.nodeKey === state.editedBranch.node && unit.branchKey === state.editedBranch.branch,
        )
        const takeable = offer.units
            .filter((unit) => unit.change === "upgrade" || unit.change === "added")
            .map((unit) => unit.id)
        need(takeable.length > 0, "NOTHING_TO_TAKE")
        await ok(buyer, buyerWorkspaceId, ACCEPT, {
            input: { installationId: offer.installationId, unitIds: takeable },
        })
        const graph = (
            await ok(buyer, buyerWorkspaceId, GRAPH, { input: { agentId: state.installation.agentId, locale: "vi" } })
        ).getAgentGraph
        const node = JSON.parse(graph.draftJson).nodes.find((n) => n.key === state.editedBranch.node)
        const kept = node.decide.branches.find((b) => b.key === state.editedBranch.branch)
        return {
            checks: {
                offeredVersionTwo: offer.offered === 2 && offer.installed === 1,
                editedBranchNotTakenBlindly: edited === undefined || edited.change === "conflict",
                editedBranchKept: kept.selfCorrected === true,
            },
            seen: `${offer.units.length} units`,
        }
    })
    completed.add("update")
} catch (error) {
    if (!failures.length)
        failures.push({
            id: `${currentFlow}-script`,
            code: /^[A-Z0-9_]+$/u.test(error?.message ?? "") ? error.message : "SCRIPT_FAILURE",
            failedChecks: [],
        })
} finally {
    save()
}
if (failures.length) process.exitCode = 1
