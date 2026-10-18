// The sounds of cars scraping, bumping, crashing and skidding. Each kind waits a few
// ticks before it plays again (see coolDownCarSounds).

import { random } from "../core/random.js";
import { playSound } from "./audio.js";

var bfgscrape = 0;
export function groundScrapeSound(typ, sx, sy, sz) {
  if (bfgscrape == 0) {
    let smag = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (smag > 5) {
      let scpr = 0.5 + ((smag - 5) / 20) * 0.5;
      if (scpr > 1) {
        scpr = 1;
      }
      let sdt = 0;
      if (typ == 2) {
        sdt += 2;
      }
      if (random.fx() > random.fx()) {
        playSound(23 + sdt, scpr);
      } else {
        playSound(24 + sdt, scpr);
      }
      bfgscrape = 5;
    }
  }
}
var bfscrape = 0;
var lscrape = -1;
export function scrapeSound(sx, sy, sz) {
  if (bfscrape == 0) {
    if (Math.sqrt(sx * sx + sy * sy + sz * sz) > 5) {
      let srp = Math.floor(random.fx() * 3);
      if (srp == 4) {
        srp = 0;
      }
      while (srp == lscrape) {
        srp = Math.floor(random.fx() * 3);
        if (srp == 4) {
          srp = 0;
        }
      }
      playSound(srp + 20, 1);
      bfscrape = 5;
    }
  }
}
var bfbump = [0, 0];
var onbsnd = false;
export function bumpSound(bi, bmag, typ) {
  if (bfbump[bi] == 0 && bmag > 10) {
    let bmpr = ((bmag - 10) / 20) * 0.3;
    if (bmpr > 0.3) {
      bmpr = 0.3;
    }
    if (typ == 2) {
      bmpr += 0.2;
    } else {
      bmpr += 0.4;
    }
    bmpr += 0.2 * random.fx();
    if (onbsnd) {
      playSound(18, bmpr);
      onbsnd = false;
    } else {
      playSound(19, bmpr);
      onbsnd = true;
    }
    bfbump[bi] = 4;
  }
}
var bfcrash = [0, 0, 0, 0];
var lcrlow = -1;
var lcrmed = -1;
var lcrhig = -1;
export function crashSound(cmag, sign) {
  if (sign == 0) {
    if (bfcrash[0] == 0 && Math.abs(cmag) > 2.5 && Math.abs(cmag) < 10) {
      let crp = Math.floor(random.fx() * 3);
      if (crp == 4) {
        crp = 0;
      }
      while (crp == lcrlow) {
        crp = Math.floor(random.fx() * 3);
        if (crp == 4) {
          crp = 0;
        }
      }
      playSound(crp + 14, 1);
      lcrlow = crp;
      bfcrash[0] = 3;
    }
    if (bfcrash[1] == 0 && Math.abs(cmag) >= 10 && Math.abs(cmag) < 17) {
      let crp = Math.floor(random.fx() * 3);
      if (crp == 4) {
        crp = 0;
      }
      while (crp == lcrmed) {
        crp = Math.floor(random.fx() * 3);
        if (crp == 4) {
          crp = 0;
        }
      }
      playSound(crp + 11, 1);
      lcrmed = crp;
      bfcrash[1] = 3;
    }
    if (bfcrash[2] == 0 && Math.abs(cmag) >= 17) {
      let crp = Math.floor(random.fx() * 3);
      if (crp == 4) {
        crp = 0;
      }
      while (crp == lcrhig) {
        crp = Math.floor(random.fx() * 3);
        if (crp == 4) {
          crp = 0;
        }
      }
      playSound(crp + 8, 1);
      lcrhig = crp;
      bfcrash[2] = 3;
    }
  }
  if (bfcrash[3] == 0) {
    if (sign == -1) {
      if (Math.abs(cmag) >= 2.5 && Math.abs(cmag) < 10) {
        playSound(15, 1);
      }
      if (Math.abs(cmag) >= 10 && Math.abs(cmag) < 17) {
        playSound(12, 1);
      }
      if (Math.abs(cmag) >= 17) {
        playSound(10, 1);
      }
      bfcrash[3] = 3;
    }
    if (sign == 1) {
      playSound(17, 1);
      bfcrash[3] = 4;
    }
  }
}
var bfskid = 0;
var sklast = [0, 1];
var dsklast = [0, 1];
export function skidSound(typ, ontsk, gmag) {
  if (bfskid == 0) {
    if (gmag > 10) {
      let spbr = (gmag - 10) * 0.0363 + 0.8;
      if (spbr < 0.8) {
        spbr = 0.8;
      }
      if (spbr > 1.2) {
        spbr = 1.2;
      }
      if (ontsk && typ == 1 && random.fx() > random.fx()) {
        typ = 0;
      }
      if (typ == 0) {
        let skp = Math.floor(random.fx() * 4);
        if (skp == 4) {
          skp = 0;
        }
        while (skp == sklast[0] || skp == sklast[1]) {
          skp = Math.floor(random.fx() * 4);
          if (skp == 4) {
            skp = 0;
          }
        }
        playSound(skp, spbr);
        sklast[1] = sklast[0];
        sklast[0] = skp;
      } else {
        let skp = Math.floor(random.fx() * 4);
        if (skp == 4) {
          skp = 0;
        }
        while (skp == dsklast[0] || skp == dsklast[1]) {
          skp = Math.floor(random.fx() * 4);
          if (skp == 4) {
            skp = 0;
          }
        }
        playSound(skp + 4, spbr);
        dsklast[1] = dsklast[0];
        dsklast[0] = skp;
      }
      bfskid = Math.floor(random.fx() * 20);
      if (bfskid < 5) {
        bfskid = 5;
      }
    }
  }
}

// Once per tick, from the engine sound.
export function coolDownCarSounds() {
  if (bfskid != 0) {
    bfskid--;
  }
  for (let i = 0; i < 4; i++) {
    if (bfcrash[i] != 0) {
      bfcrash[i]--;
    }
  }
  for (let i = 0; i < 2; i++) {
    if (bfbump[i] != 0) {
      bfbump[i]--;
    }
  }
  if (bfscrape != 0) {
    bfscrape--;
  }
  if (bfgscrape != 0) {
    bfgscrape--;
  }
}
