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
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use simrandom() for the simulation or fxrandom() for effects, so tests can seed them.",
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
];
