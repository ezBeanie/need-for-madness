import globals from "globals";

export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        // gl-matrix, loaded as classic script in index.html
        mat4: "readonly",
        quat: "readonly",
        vec3: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      // legacy functions keep unused parameters and empty catch bindings of the original
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use random.sim() for the simulation or random.fx() for effects, so tests can seed them.",
        },
      ],
    },
  },
  {
    files: ["test/**/*.js", "*.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    // page.evaluate callbacks run in the browser
    files: ["test/visual/**/*.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
