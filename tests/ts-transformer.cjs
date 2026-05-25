const ts = require("typescript");

module.exports = {
  process(sourceText, sourcePath) {
    if (!sourcePath.endsWith(".ts") && !sourcePath.endsWith(".tsx")) {
      return { code: sourceText };
    }

    return {
      code: ts.transpileModule(sourceText, {
        compilerOptions: {
          esModuleInterop: true,
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          target: ts.ScriptTarget.ES2020,
        },
      }).outputText,
    };
  },
};
