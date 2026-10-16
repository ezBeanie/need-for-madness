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
// to it by the last render(). body is the instance the body is drawn for: car[c] in a race,
// carobj[typ] in the menus.
export const wheelsOnBody = (ctx, typ, body, alpha) => {
  const { mat4 } = ctx;
  ctx.interpolation.alpha = alpha;
  const fromBody = mat4.invert(
    mat4.create(),
    drawnMatrix(ctx, ctx.carModels[typ], body),
  );
  return ctx.whl[typ].map((wheel, w) => {
    const drawn = drawnMatrix(ctx, ctx.tired[typ][w >> 1], wheel);
    const onBody = mat4.multiply(mat4.create(), fromBody, drawn);
    return [onBody[12], onBody[13], onBody[14]];
  });
};

// How far the wheels move on the body when drawn between ticks instead of at the tick.
export const wheelSlip = (ctx, typ, body) => {
  const atTick = wheelsOnBody(ctx, typ, body, 1);
  let worst = 0;
  for (const alpha of [0.25, 0.5, 0.75]) {
    wheelsOnBody(ctx, typ, body, alpha).forEach((pos, w) => {
      const off = Math.hypot(...pos.map((v, i) => v - atTick[w][i]));
      worst = Math.max(worst, off);
    });
  }
  return worst;
};
