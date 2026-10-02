// Lets a script outside Next import modules that start with `import "server-only"` (the package throws unless Next resolves it), and gives client
// components a router that does nothing (next/navigation needs the app router mounted).
const Module = require("node:module");
const path = require("node:path");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return path.join(__dirname, "empty.cjs");
  if (request === "next/navigation") return path.join(__dirname, "navigation-stub.cjs");
  return resolve.call(this, request, ...rest);
};
