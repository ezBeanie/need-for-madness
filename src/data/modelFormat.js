// The Radical Play 3D model format (.r3d): directive lines such as `car()`, `scale(1.2)`
// or `texture(car0.png)`, followed by four data lines
//   v(x,y,z,...)v  vertex positions      n(x,y,z,...)n  normals
//   t(u,v,...)t    texture coordinates   p(v,n,t,...)p  triangles, as vertex/normal/uv index triples

const DATA_LINES = {
  v: ["vertices", parseFloat],
  n: ["normals", parseFloat],
  t: ["texcoords", parseFloat],
  p: ["triangles", parseInt],
};

// Returns { directives: [{ command, value }], vertices, normals, texcoords, triangles }.
// Directives keep the file order; value is the raw text inside the parentheses.
export const parseModel = (source) => {
  const model = {
    directives: [],
    vertices: [],
    normals: [],
    texcoords: [],
    triangles: [],
  };
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z]+)\(([^)]*)\)/);
    if (!match) {
      continue;
    }
    const [, command, value] = match;
    const data = DATA_LINES[command];
    if (data && line.includes(`)${command}`)) {
      const [field, parse] = data;
      model[field] = value.split(",").map((number) => parse(number));
    } else if (!data) {
      model.directives.push({ command, value });
    }
  }
  return model;
};
