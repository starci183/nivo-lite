// Preload for scripts/video-module-check.cts: the app's server modules import Next request APIs that do not exist outside a request.
// These stubs make the SAME server functions runnable from a script (service role, no session).
const Module = require("module");
const orig = Module._load;
const jar = { get: () => undefined, getAll: () => [], set: () => undefined, has: () => false, delete: () => undefined };
const stubs = {
  "server-only": {},
  "next/headers": { cookies: async () => jar, headers: async () => new Headers() },
  "next/navigation": { redirect: (u) => { throw new Error(`redirect ${u}`); }, notFound: () => { throw new Error("notFound"); }, usePathname: () => "/", useRouter: () => ({}) },
  "next/cache": { revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn) => fn },
  "next/server": { after: (fn) => { Promise.resolve().then(fn).catch((e) => console.error("after()", e)); }, NextResponse: class {}, NextRequest: class {} },
};
Module._load = function (request, ...rest) {
  return Object.prototype.hasOwnProperty.call(stubs, request) ? stubs[request] : orig.call(this, request, ...rest);
};
