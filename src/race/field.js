// The field of a race: the opponents for the stage and their places on the start grid.

import { random } from "../core/random.js";
import { MAX_CARS, RACE_SIZES, game } from "../core/state.js";
import { saveSetting } from "../core/storage.js";
import { carStats } from "../data/carStats.js";
import { gamecartextures } from "../render/generated.js";
import { inishinter } from "../ui/hud.js";
import { inishcontrol } from "./ai.js";
import { inishmad } from "./physics.js";
import { car } from "./racers.js";
import { inishrecord } from "./recording.js";
import { track } from "./track.js";

// The start grid: one car in the middle, then two side by side, and so on backwards.
var xstart = Array.from({ length: MAX_CARS }, (_, i) => [0, -35, 35][i % 3]);
var zstart = Array.from(
  { length: MAX_CARS },
  (_, i) => -76 + 38 * (Math.floor(i / 3) * 2 + (i % 3 == 0 ? 0 : 1)),
);
function inishcars() {
  for (var i = 0; i < game.carCount; i++) {
    car[i].typ = game.carTypes[i];
    car[i].x = xstart[i] + 4 * random.sim() - 2;
    car[i].z = zstart[i];
    car[i].grat =
      carStats.wly[car[i].typ][1] + 1.5 * carStats.wlh[car[i].typ][1];
    car[i].y = car[i].grat;
    car[i].xy = 0;
    car[i].xz = 0;
    car[i].zy = 0;
    car[i].wzy = 0;
    car[i].wxz = 0;
    car[i].keyx[0] = -carStats.wlx[car[i].typ][0];
    car[i].keyz[0] = carStats.wlz[car[i].typ][0];
    car[i].keyx[1] = carStats.wlx[car[i].typ][0];
    car[i].keyz[1] = carStats.wlz[car[i].typ][0];
    car[i].keyx[2] = -carStats.wlx[car[i].typ][1];
    car[i].keyz[2] = carStats.wlz[car[i].typ][1];
    car[i].keyx[3] = carStats.wlx[car[i].typ][1];
    car[i].keyz[3] = carStats.wlz[car[i].typ][1];
    car[i].mat = mat4.create();
    car[i].ctxl[0] = random.fx();
    car[i].ctxl[1] = random.fx();
    car[i].fcnt = 0;
  }
}
// Chooses the opponents and puts all cars on the start grid.
export function setupcars() {
  track.insih();
  sortcars(track.stage);

  inishinter();
  inishcars();
  inishcontrol();
  inishmad();
  inishrecord();
}
// the field size the cars were chosen for; it can change in the stage select after the stage loaded with its cars.
let sortedcars = 0;
export function applyracecars() {
  if (sortedcars != game.raceCars) {
    setupcars();
    gamecartextures();
  }
}
function sortcars(stage) {
  game.carCount = game.raceCars;
  sortedcars = game.raceCars;
  for (var i = 1; i < game.carCount; i++) {
    game.carTypes[i] = -1;
  }
  var oks = [];
  var ti = game.carCount;
  if (game.carTypes[0] != Math.floor(10 + (stage + 1) / 2) && stage != 17) {
    game.carTypes[game.carCount - 1] = Math.floor(10 + (stage + 1) / 2);
    ti = game.carCount - 1;
  }
  for (var i = 1; i < ti; i++) {
    oks[i] = false;
    var tries = 0;
    while (!oks[i]) {
      tries++;
      game.carTypes[i] = Math.floor(random.sim() * (28 + 10 * (stage / 17)));
      if (game.carTypes[i] >= 19) {
        game.carTypes[i] -= 19;
      }
      if (game.carTypes[i] == 19) {
        game.carTypes[i] = 18;
      }
      oks[i] = true;
      // the original seven always differ; beyond them there are not enough car types
      if (i < 7 || tries < 50) {
        for (var j = 0; j < game.carCount; j++) {
          if (i != j && game.carTypes[i] == game.carTypes[j]) {
            oks[i] = false;
          }
        }
      }
      if ((stage != 15 && stage != 16) || game.unlocked != stage) {
        var outproba = ((18 - game.carTypes[i]) / 18) * (stage / 16);
        if (outproba > 0.8) {
          outproba = 0.8;
        }
        if (stage == 17) {
          if (outproba > 0.5) {
            outproba = 0.5;
          }
        }
        if (outproba > random.sim()) {
          oks[i] = false;
        }
      }
      if ((game.carTypes[i] - 10) * 2 > game.unlocked) {
        oks[i] = false;
      }
      if (
        stage == 6 &&
        game.unlocked == 6 &&
        (game.carTypes[i] == 2 ||
          game.carTypes[i] == 4 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9)
      ) {
        oks[i] = false;
      }
      if (
        stage == 8 &&
        game.unlocked == 8 &&
        (game.carTypes[i] == 4 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9)
      ) {
        if (random.sim() > random.sim()) {
          oks[i] = false;
        }
      }
      if (
        stage == 9 &&
        game.unlocked == 9 &&
        (game.carTypes[i] == 4 ||
          game.carTypes[i] == 3 ||
          game.carTypes[i] == 0 ||
          game.carTypes[i] == 2)
      ) {
        if (random.sim() > random.sim()) {
          oks[i] = false;
        }
      }
      if (
        stage == 10 &&
        game.unlocked == 10 &&
        (game.carTypes[i] == 2 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9 ||
          game.carTypes[i] == 14)
      ) {
        if (random.sim() > random.sim()) {
          oks[i] = false;
        }
      }
      if (
        stage == 11 &&
        game.unlocked == 11 &&
        (game.carTypes[i] == 0 ||
          game.carTypes[i] == 1 ||
          game.carTypes[i] == 2 ||
          game.carTypes[i] == 3 ||
          game.carTypes[i] == 4 ||
          game.carTypes[i] == 14)
      ) {
        oks[i] = false;
      }
      if (stage == 12 && game.unlocked == 12 && game.carTypes[i] <= 4) {
        oks[i] = false;
      }
      if (stage == 13 && game.unlocked == 13) {
        if (game.carTypes[i] <= 4) {
          oks[i] = false;
        }
        if (game.carTypes[i] == 14 || game.carTypes[i] == 16) {
          if (random.sim() > random.sim()) {
            oks[i] = false;
          }
        }
      }
      if (
        stage == 14 &&
        game.unlocked == 14 &&
        (game.carTypes[i] == 0 ||
          game.carTypes[i] == 2 ||
          game.carTypes[i] == 3 ||
          game.carTypes[i] == 4 ||
          game.carTypes[i] == 6 ||
          game.carTypes[i] == 9 ||
          game.carTypes[i] == 14 ||
          game.carTypes[i] == 16)
      ) {
        oks[i] = false;
      }
      if (stage == 15 && game.unlocked == 15) {
        if (game.carTypes[i] < 5) {
          oks[i] = false;
        }
        if (game.carTypes[i] < 11) {
          if (random.sim() > 0.1) {
            oks[i] = false;
          }
        }
      }
      if (stage == 16 && game.unlocked == 16) {
        if (game.carTypes[i] < 11) {
          oks[i] = false;
        }
      }
    }
  }
  if (stage == 6 && game.unlocked == 6) {
    var okcar = false;
    for (var i = 0; i < game.carCount; i++) {
      if (game.carTypes[i] == 11) {
        okcar = true;
      }
    }
    if (!okcar) {
      var ssel = 18;
      var ssi = 1;
      for (var i = 1; i < ti; i++) {
        if (game.carTypes[i] < ssel) {
          ssel = game.carTypes[i];
          ssi = i;
        }
      }
      game.carTypes[ssi] = 11;
    }
  }
  if (stage == 12 && game.unlocked == 12) {
    var okcar = false;
    for (var i = 0; i < game.carCount; i++) {
      if (game.carTypes[i] == 14) {
        okcar = true;
      }
    }
    if (!okcar) {
      var ssi = Math.floor(1 + 5 * random.sim());
      if (ssi == 6) {
        ssi = 5;
      }
      game.carTypes[ssi] = 14;
    }
  }
  if (stage == 16 && game.unlocked == 16) {
    var okcar = false;
    for (var i = 0; i < game.carCount; i++) {
      if (game.carTypes[i] == 16) {
        okcar = true;
      }
    }
    if (!okcar) {
      var ssi = Math.floor(1 + 5 * random.sim());
      if (ssi == 6) {
        ssi = 5;
      }
      game.carTypes[ssi] = 16;
    }
    var tk = 1;
    if (random.sim() > random.sim()) {
      tk = 2;
    }
    for (var i = 3; i < 6; i++) {
      if (game.carTypes[i] == 16) {
        game.carTypes[i] = game.carTypes[tk];
        game.carTypes[tk] = 16;
      }
    }
    if (tk == 1) {
      tk = 2;
    } else {
      tk = 1;
    }
    for (var i = 3; i < 6; i++) {
      if (game.carTypes[i] == 14) {
        game.carTypes[i] = game.carTypes[tk];
        game.carTypes[tk] = 14;
      }
    }
    tk = 4;
    if (random.sim() > random.sim()) {
      tk = 5;
    }
    for (var i = 1; i < 4; i++) {
      if (game.carTypes[i] == 15) {
        game.carTypes[i] = game.carTypes[tk];
        game.carTypes[tk] = 15;
      }
    }
  }
}
export function nextRaceSize() {
  game.raceCars =
    RACE_SIZES[(RACE_SIZES.indexOf(game.raceCars) + 1) % RACE_SIZES.length];
  saveSetting("racecars", game.raceCars);
}
