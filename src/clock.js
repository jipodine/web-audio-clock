/*global performance */

let clock = {};

clock.splitTime = function (time) {
  const seconds = Math.floor(time % 60);
  const sub = time % 1;
  const minutes = Math.floor((time / 60) % 60);
  const hours = Math.floor((time / (60 * 60)) % 60);
  return [hours, minutes, seconds, sub];
};


clock.timeString = function (time) {
  const t = clock.splitTime(time);
  return t[0] + '° : '
    + t[1] + "' : "
    + t[2] + '" : '
    + t[3];
};

clock.TimeDelta  = class {
  constructor() {
    this.last = 0;
  }
  getTimeDelta(time) {
    const delta = time - this.last;
    this.last = time;
    return [time, delta];
  }
};

clock.getPerformanceTime = function() {
  return ( (typeof performance !== 'undefined') && performance.now
           ? performance.now() * 1e-3
           : 0);
};

module.exports = exports = clock;
