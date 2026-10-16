// The model matrix rad is drawn with for instance inst, handed over like render() does.
export const drawnMatrix = (ctx, rad, inst) => {
  rad.x = inst.x;
  rad.y = inst.y;
  rad.z = inst.z;
  rad.mat = inst.mat;
  ctx.placeModel(rad);
  return ctx.mat4.clone(ctx.drawMatrix);
};

// Where the wheels of car type typ are drawn, seen from the drawn car body, as attached
// to it by the last render(). body and wheels are the instances drawn: car[c] and
// racers[c].wheels in a race, carModels[typ] and showcaseWheels[typ] in the menus.
export const wheelsOnBody = (ctx, typ, body, wheels, alpha) => {
  const { mat4 } = ctx;
  ctx.interpolation.alpha = alpha;
  const fromBody = mat4.invert(
    mat4.create(),
    drawnMatrix(ctx, ctx.carModels[typ], body),
  );
  return wheels.map((wheel, w) => {
    const drawn = drawnMatrix(ctx, ctx.wheelDisks[typ][w >> 1], wheel);
    const onBody = mat4.multiply(mat4.create(), fromBody, drawn);
    return [onBody[12], onBody[13], onBody[14]];
  });
};

// How far the wheels move on the body when drawn between ticks instead of at the tick.
export const wheelSlip = (ctx, typ, body, wheels) => {
  const atTick = wheelsOnBody(ctx, typ, body, wheels, 1);
  let worst = 0;
  for (const alpha of [0.25, 0.5, 0.75]) {
    wheelsOnBody(ctx, typ, body, wheels, alpha).forEach((pos, w) => {
      const off = Math.hypot(...pos.map((v, i) => v - atTick[w][i]));
      worst = Math.max(worst, off);
    });
  }
  return worst;
};

// Records every model drawn from now on: its index buffer (unique per model) and where it
// is drawn, relative to the camera.
export const recordDraws = (ctx) => {
  const draws = [];
  const { gl } = ctx;
  let elements = null;
  let modelView = null;
  const { bindBuffer, uniformMatrix4fv, drawElements } = gl;
  gl.bindBuffer = (target, buffer) => {
    if (target === gl.ELEMENT_ARRAY_BUFFER) {
      elements = buffer;
    }
    return bindBuffer(target, buffer);
  };
  gl.uniformMatrix4fv = (location, transpose, value) => {
    if (value === ctx.drawMatrix) {
      modelView = [value[12], value[13], value[14]];
    }
    return uniformMatrix4fv(location, transpose, value);
  };
  gl.drawElements = (...args) => {
    draws.push({ elements, at: modelView });
    return drawElements(...args);
  };
  return draws;
};
