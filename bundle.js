(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Use chrome.storage.local if we are in an app
 */

var storage;

if (typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined')
  storage = chrome.storage.local;
else
  storage = localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      storage.removeItem('debug');
    } else {
      storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":2}],2:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":3}],3:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],4:[function(require,module,exports){
"use strict";

/*global AudioContext */

var audio = {};

audio.getTime = function () {
  return audio.context.currentTime;
};

audio.dBToLin = function (dBValue) {
  return Math.pow(10, dBValue / 20);
};

audio.minPowerOfTwo = function (value) {
  var bitMax = arguments[1] === undefined ? 16 : arguments[1];
  var precision = arguments[2] === undefined ? 0.00001 : arguments[2];

  var power = 0;
  var bit = 0;

  var v = Math.abs(value);
  if (v > precision && Math.abs(v - Math.round(v)) < precision) {
    power = 1;
    v = Math.round(v) * 0.5;
    while (v % 1 < precision && bit < bitMax) {
      power *= 2;
      ++bit;
      v *= 0.5;
    }
  }
  return [power, bit];
};

var generateClickBuffer = function generateClickBuffer() {
  var length = 2;
  var channels = 1;
  var gain = -10; // dB

  var buffer = audio.context.createBuffer(channels, length, audio.context.sampleRate);
  var data = buffer.getChannelData(0);

  var amplitude = audio.dBToLin(gain);
  data[0] = amplitude;
  data[1] = -amplitude;

  return buffer;
};

var generateNoiseBuffer = function generateNoiseBuffer() {
  var duration = 0.2; // second
  var gain = -30; // dB

  var length = duration * audio.context.sampleRate;
  var amplitude = audio.dBToLin(gain);
  var channelCount = audio.context.destination.channelCount;
  var buffer = audio.context.createBuffer(channelCount, length, audio.context.sampleRate);
  for (var c = 0; c < channelCount; ++c) {
    var data = buffer.getChannelData(c);
    for (var i = 0; i < length; ++i) {
      data[i] = amplitude * (Math.random() * 2 + 1);
    }
  }

  return buffer;
};

audio.triggerSound = function (buffer) {
  var bufferSource = audio.context.createBufferSource();
  bufferSource.buffer = buffer;
  bufferSource.connect(audio.context.destination);
  bufferSource.start(0);
};

audio.started = false;
audio.init = function () {
  if (!audio.started && typeof audio.context !== "undefined") {
    return;
  }
  try {
    audio.context = new AudioContext();
  } catch (e) {
    window.alert("This browser doesn't support the Web Audio API." + "Try the latest version of Chrome or Firefox.");
    return;
  }

  audio.clickBuffer = generateClickBuffer();
  audio.noiseBuffer = generateNoiseBuffer();

  audio.started = true;
};

module.exports = exports = audio;

},{}],5:[function(require,module,exports){
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

/*global performance */

var clock = {};

clock.splitTime = function (time) {
  var seconds = Math.floor(time % 60);
  var sub = time % 1;
  var minutes = Math.floor(time / 60 % 60);
  var hours = Math.floor(time / (60 * 60) % 60);
  return [hours, minutes, seconds, sub];
};

clock.timeString = function (time) {
  var t = clock.splitTime(time);
  return t[0] + "° : " + t[1] + "' : " + t[2] + "\" : " + t[3];
};

clock.TimeDelta = (function () {
  var _class = function () {
    _classCallCheck(this, _class);

    this.last = 0;
  };

  _createClass(_class, {
    getTimeDelta: {
      value: function getTimeDelta(time) {
        var delta = time - this.last;
        this.last = time;
        return [delta, time];
      }
    }
  });

  return _class;
})();

clock.getPerformanceTime = function () {
  return typeof performance !== "undefined" && performance.now ? performance.now() * 0.001 : 0;
};

module.exports = exports = clock;

},{}],6:[function(require,module,exports){
"use strict";

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) { _arr.push(_step.value); if (i && _arr.length === i) break; } return _arr; } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var app = window.app || {};

var debug = require("debug")("web-audio-clock");
app.audio = require("./audio.js");
app.clock = require("./clock.js");

app.Measure = (function () {
  var _class = function () {
    _classCallCheck(this, _class);

    // this.request = null;
    this.count = 0;
    this.display = "";
    this.dateDelta = new app.clock.TimeDelta();
    this.audioDelta = new app.clock.TimeDelta();
    this.frameDelta = new app.clock.TimeDelta();
    this.perfDelta = new app.clock.TimeDelta();
  };

  _createClass(_class, {
    init: {
      value: function init(request) {
        var _this = this;

        this.request = request;
        this.count = 10;
        this.display = "";
        if (this.request) {
          this.request(function (frameTime) {
            _this.pick(frameTime);
          });
        }
      }
    },
    pick: {
      value: function pick() {
        var _this = this;

        var frameTime = arguments[0] === undefined ? 0 : arguments[0];

        if (this.count-- > 0) {
          var date = {};

          var _ref = this.dateDelta.getTimeDelta(Date.now() * 0.001);

          var _ref2 = _slicedToArray(_ref, 2);

          date.delta = _ref2[0];
          date.time = _ref2[1];

          var audio = {};

          var _ref3 = this.audioDelta.getTimeDelta(app.audio.context.currentTime);

          var _ref32 = _slicedToArray(_ref3, 2);

          audio.delta = _ref32[0];
          audio.time = _ref32[1];

          audio.deltaSamples = audio.delta * app.audio.context.sampleRate;

          var _ref4 = app.audio.minPowerOfTwo(audio.deltaSamples);

          var _ref42 = _slicedToArray(_ref4, 1);

          audio.deltaSamplesPow2 = _ref42[0];

          var frame = {};

          var _ref5 = this.frameDelta.getTimeDelta(frameTime * 0.001);

          var _ref52 = _slicedToArray(_ref5, 2);

          frame.delta = _ref52[0];
          frame.time = _ref52[1];

          if (frame.time === 0) {
            frame.delta = 0;
          }

          var perf = {};

          var _ref6 = this.perfDelta.getTimeDelta(app.clock.getPerformanceTime());

          var _ref62 = _slicedToArray(_ref6, 2);

          perf.delta = _ref62[0];
          perf.time = _ref62[1];

          this.display += "++++++++++ " + this.count + " ++++++++++" + "<br>" + "Date: " + date.time + "; ∆ = " + date.delta + " (" + date.delta * app.audio.context.sampleRate + ")" + "<br>" + "Audio: " + audio.time + "; ∆ = " + audio.delta + " (" + audio.deltaSamples + " -> " + audio.deltaSamplesPow2 + ")" + "<br>" + "Frame: " + frame.time + "; ∆ = " + frame.delta + " (" + frame.delta * app.audio.context.sampleRate + ")" + "<br>" + "Perf.: " + perf.time + "; ∆ = " + perf.delta + " (" + perf.delta * app.audio.context.sampleRate + ")" + "<br>" + "<br>";

          if (this.request) {
            this.request(function (frameTime) {
              _this.pick(frameTime);
            });
          }
        } else {
          document.querySelector("#measure").innerHTML = "∆ = seconds (samples -> buffer size)" + "<br><br>" + this.display;
        }
      }
    }
  });

  return _class;
})();

app.measure = new app.Measure();

app.displayAudioTime = function (frameTime) {
  var d = new Date();
  document.querySelector("#date-time").innerHTML = "Date: " + new Date().toString() + " (" + d.getTime() + ")";

  document.querySelector("#audio-time").innerHTML = "Audio: " + app.clock.timeString(app.audio.context.currentTime);

  document.querySelector("#frame-time").innerHTML = "Frame: " + app.clock.timeString(frameTime * 0.001);

  document.querySelector("#performance-time").innerHTML = "Performance: " + app.clock.timeString(app.clock.getPerformanceTime());

  requestAnimationFrame(app.displayAudioTime);
};

app.init = function () {
  document.querySelector("#time-started").innerHTML = "Loaded " + new Date().toString();

  app.audio.init();

  document.querySelector("#sample-rate").innerHTML = "Audio sample-rate: " + app.audio.context.sampleRate + " Hz";

  document.querySelector("#active-raf").onclick = function () {
    app.audio.triggerSound(app.audio.noiseBuffer);
    app.measure.init(requestAnimationFrame.bind(window));
  };

  document.querySelector("#active-timeout").onclick = function () {
    app.audio.triggerSound(app.audio.noiseBuffer);
    app.measure.init(function (fun) {
      window.setTimeout(fun, 0);
    });
  };

  document.querySelector("#active-once").onclick = function () {
    app.audio.triggerSound(app.audio.clickBuffer);
    if (app.measure.count <= 0) {
      app.measure.init();
    }
    app.measure.pick(0);
    document.querySelector("#measure").innerHTML = app.measure.display;
  };
};

window.addEventListener("DOMContentLoaded", function () {
  app.init();

  requestAnimationFrame(app.displayAudioTime);
});

window.app = app;

},{"./audio.js":4,"./clock.js":5,"debug":1}]},{},[6]);
