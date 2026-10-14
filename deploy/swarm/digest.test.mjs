import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { DIGEST_REF, hasPlaceholderDigest, isImageReference } from "./digest.mjs"

const placeholder = `ghcr.io/example/api@sha256:${"0".repeat(64)}`
const pinned = `ghcr.io/example/api@sha256:${"0".repeat(63)}1`

test("digest references require a nonzero, complete sha256 digest", () => {
    assert.equal(DIGEST_REF.test(placeholder), false)
    assert.equal(DIGEST_REF.test(pinned), true)
    assert.equal(DIGEST_REF.test(pinned.replace("/api@", "/api:release@")), true)
    assert.equal(DIGEST_REF.test(pinned.slice(0, -1)), false)
    assert.equal(DIGEST_REF.test(`${pinned}0`), false)
    assert.equal(DIGEST_REF.test("ghcr.io/example/api:local"), false)
})

test("allow-unpinned never accepts a placeholder or a missing image", () => {
    for (const allowUnpinned of [false, true]) {
        assert.equal(isImageReference(placeholder, allowUnpinned), false)
        assert.equal(isImageReference(undefined, allowUnpinned), false)
        assert.equal(isImageReference("", allowUnpinned), false)
        assert.equal(isImageReference(pinned, allowUnpinned), true)
    }
    assert.equal(isImageReference("ghcr.io/example/api:local"), false)
    assert.equal(isImageReference("ghcr.io/example/api:local", true), true)
})

test("render CLI rejects placeholder images before loading secrets or calling docker", () => {
    for (const image of ["api", "web"]) {
        for (const allowUnpinned of [false, true]) {
            const run = spawnSync(
                process.execPath,
                [
                    fileURLToPath(new URL("./render.mjs", import.meta.url)),
                    "--api-image",
                    image === "api" ? placeholder : pinned,
                    "--web-image",
                    image === "web" ? placeholder : pinned,
                    ...(allowUnpinned ? ["--allow-unpinned"] : []),
                ],
                { encoding: "utf8" },
            )
            assert.ifError(run.error)
            assert.equal(run.status, 1)
            assert.equal(run.stdout, "")
            assert.equal(run.stderr, `swarm: --${image}-image must be a registry reference pinned by @sha256 digest\n`)
        }
    }
})

test("rendered stack guard finds surviving placeholders in any service", () => {
    const stack = `services:\n  api:\n    image: ${pinned}\n  web:\n    image: "${placeholder}"\n`
    assert.equal(hasPlaceholderDigest(stack), true)
    assert.equal(hasPlaceholderDigest(Buffer.from(stack)), true)
    assert.equal(hasPlaceholderDigest(stack.replace(placeholder, pinned)), false)
    assert.equal(hasPlaceholderDigest(`${placeholder}1`), false)
    assert.equal(hasPlaceholderDigest("services: {}\n"), false)
})
