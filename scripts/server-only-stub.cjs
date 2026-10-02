// Lets a script outside Next import modules that start with `import "server-only"` (the package throws unless Next resolves it).
const Module = require("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === "server-only" ? require.resolve("./empty.cjs") : resolve.call(this, request, ...rest);
};
