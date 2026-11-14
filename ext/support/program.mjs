// What the project check programs of ext/checks/ share: run a command from the app root with the output passed through, and build the
// workspace packages a check reads. This file is no check: it lives in ext/support/ because the harness's R103 refuses a file of ext/checks/
// that ext/manifest.json `checks` does not declare.
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** The app root: ext/support/../.. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Runs `command` with `args` from the app root, output inherited; its exit status (1 when it could not start). */
export const run = (command, args, { shell = false } = {}) => {
    const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell })
    if (result.error !== undefined) console.error(`${command} ${args.join(" ")}: ${result.error.message}`)
    return result.status ?? 1
}

/** Runs a node script of the app with the Node that runs this check. */
export const node = (...args) => run(process.execPath, args)

/**
 * Builds the workspace packages (`npm run build:modules`: turbo over ./packages/*). A check whose program reads the built packages calls it
 * first: the harness's check contract (hfs 6.9.0, R402) declares no `needs`, runs every check as a `build` child of the heavy governor and
 * never caches its verdict, so the check itself makes what it reads. It is idempotent: turbo restores an unchanged package from its cache,
 * so a second check (or a second run) pays only the cache lookup. It writes only build output (dist/), never source.
 */
export const buildModules = () => run("npm", ["run", "build:modules", "--silent"], { shell: process.platform === "win32" })

/**
 * Builds ONE workspace package (`npm run build -w <name>`), for a check that reads only that package and so does not depend on the build of
 * the others (another worker's edit in flight elsewhere must not hide its verdict). Only for a package with no workspace dependency.
 */
export const buildPackage = (name) => run("npm", ["run", "build", "--silent", "-w", name], { shell: process.platform === "win32" })

/** Exits with the first non-zero status of `steps` (each a function returning a status), running them in order; 0 when all pass. */
export const exitWith = (...steps) => {
    for (const step of steps) {
        const status = step()
        if (status !== 0) process.exit(status)
    }
    process.exit(0)
}
