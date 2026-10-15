import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseModel } from "../src/data/modelFormat.js";

const MODELS = new URL("../public/data/3D/", import.meta.url);

describe("model format", () => {
  test("reads directives in order and the four data lines", () => {
    const model = parseModel(
      [
        "# Radical Play - 3D Object Format",
        "car()",
        "scale(1.5)",
        "texture(car0.png)",
        "v(1,2,3,4.5,5,6)v",
        "n(0,1,0)n",
        "t(0.5,0.25)t",
        "p(0,0,0,1,0,0)p",
      ].join("\n"),
    );
    expect(model).toEqual({
      directives: [
        { command: "car", value: "" },
        { command: "scale", value: "1.5" },
        { command: "texture", value: "car0.png" },
      ],
      vertices: [1, 2, 3, 4.5, 5, 6],
      normals: [0, 1, 0],
      texcoords: [0.5, 0.25],
      triangles: [0, 0, 0, 1, 0, 0],
    });
  });

  test.each(readdirSync(MODELS).filter((file) => file.endsWith(".r3d")))(
    "%s has whole triangles referencing existing vertices",
    (file) => {
      const model = parseModel(readFileSync(new URL(file, MODELS), "utf8"));
      expect(model.triangles.length % 3).toBe(0);
      const vertexCount = model.vertices.length / 3;
      for (let i = 0; i < model.triangles.length; i += 3) {
        expect(model.triangles[i]).toBeLessThan(vertexCount);
      }
    },
  );
});
