import cars from "./cars.json";

// Car stats come from cars.json; some are written there in finer units.
class CarDefine {
  constructor() {
    this.names = cars.map((car) => car.name);
    // wheel positions (x, y, z), wheel height and shadow size per car type
    this.wlx = cars.map((car) => car.wheels.x);
    this.wly = cars.map((car) => car.wheels.y);
    this.wlz = cars.map((car) => car.wheels.z);
    this.wlh = cars.map((car) => car.wheels.h);
    this.shadadj = cars.map((car) => car.shadadj);
    for (var key of [
      "swits",
      "acelf",
      "handb",
      "airs",
      "airc",
      "turn",
      "grip",
      "bounce",
      "boundr",
      "simag",
      "moment",
      "comprad",
      "push",
      "revpush",
      "lift",
      "revlift",
      "powerloss",
      "flipy",
      "msquash",
      "clrad",
      "dammult",
      "maxmag",
      "dishandle",
      "outdam",
      "colrdammult",
      "engrev",
    ]) {
      this[key] = cars.map((car) =>
        Array.isArray(car[key]) ? [...car[key]] : car[key],
      );
    }
    for (var i = 0; i < 19; i++) {
      for (var k = 0; k < 3; k++) {
        this.swits[i][k] = this.swits[i][k] / 10;
        this.acelf[i][k] = this.acelf[i][k] / 10;
      }
      this.handb[i] = this.handb[i] / 10;
      this.airc[i] = this.airc[i] / 10;
      this.grip[i] = this.grip[i] / 10;
      this.lift[i] = this.lift[i] / 10;
      this.revlift[i] = this.revlift[i] / 10;
      this.flipy[i] = -(this.flipy[i] / 10);
      this.msquash[i] = this.msquash[i] / 10;
      this.clrad[i] = this.clrad[i] / 100;
      this.maxmag[i] = this.maxmag[i] / 10;
    }
  }
}

export const carStats = new CarDefine();
