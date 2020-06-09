(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
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
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

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
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
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
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
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
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

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

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":2,"_process":4}],2:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
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
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
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

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
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

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
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
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
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
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
/*global AudioContext */

"use strict";

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

},{}],6:[function(require,module,exports){
/*global performance */

"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

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
  return t[0] + "° : " + t[1] + "' : " + t[2] + "\" : " + t[3].toFixed(3).replace("0.", "");
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

},{}],7:[function(require,module,exports){
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
    this.audioBaseLatencyDelta = new app.clock.TimeDelta();
    this.audioOutputLatencyDelta = new app.clock.TimeDelta();
    this.audioTimeDelta = new app.clock.TimeDelta();
    this.audioStampDelta = new app.clock.TimeDelta();
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

          this.display += "++++++++++ " + this.count + " ++++++++++" + "<br>";
          var date = {};

          var _ref = this.dateDelta.getTimeDelta(Date.now() * 0.001);

          var _ref2 = _slicedToArray(_ref, 2);

          date.delta = _ref2[0];
          date.time = _ref2[1];

          this.display += "Date: " + date.time + "; ∆ = " + date.delta + " (" + date.delta * app.audio.context.sampleRate + ")" + "<br>";

          var audioTime = {};

          var _ref3 = this.audioTimeDelta.getTimeDelta(app.audio.context.currentTime);

          var _ref32 = _slicedToArray(_ref3, 2);

          audioTime.delta = _ref32[0];
          audioTime.time = _ref32[1];

          audioTime.deltaSamples = audioTime.delta * app.audio.context.sampleRate;

          var _ref4 = app.audio.minPowerOfTwo(audioTime.deltaSamples);

          var _ref42 = _slicedToArray(_ref4, 1);

          audioTime.deltaSamplesPow2 = _ref42[0];

          this.display += "Audio context time: " + audioTime.time + "; ∆ = " + audioTime.delta + " (" + audioTime.deltaSamples + " -> " + audioTime.deltaSamplesPow2 + ")" + "<br>";

          if (typeof app.audio.context.baseLatency === "undefined") {
            document.querySelector("#base-latency").innerHTML = "Base latency: undefined";
          } else {
            var latency = app.audio.context.baseLatency;

            document.querySelector("#base-latency").innerHTML = "Base latency: " + latency + " s";

            var audioBaseLatency = {};

            var _ref5 = this.audioBaseLatencyDelta.getTimeDelta(latency);

            var _ref52 = _slicedToArray(_ref5, 2);

            audioBaseLatency.delta = _ref52[0];
            audioBaseLatency.time = _ref52[1];

            audioBaseLatency.deltaSamples = audioBaseLatency.delta * app.audio.context.sampleRate;

            var _ref6 = app.audio.minPowerOfTwo(audioBaseLatency.deltaSamples);

            var _ref62 = _slicedToArray(_ref6, 1);

            audioBaseLatency.deltaSamplesPow2 = _ref62[0];

            this.display += "Audio base latency: " + audioBaseLatency.time + "; ∆ = " + audioBaseLatency.delta + " (" + audioBaseLatency.deltaSamples + " -> " + audioBaseLatency.deltaSamplesPow2 + ")" + "<br>";
          }

          if (typeof app.audio.context.outputLatency === "undefined") {
            document.querySelector("#output-latency").innerHTML = "Output latency: undefined";
          } else {
            var latency = app.audio.context.outputLatency;

            document.querySelector("#output-latency").innerHTML = "Output latency: " + latency + " s";

            var audioOutputLatency = {};

            var _ref7 = this.audioOutputLatencyDelta.getTimeDelta(latency);

            var _ref72 = _slicedToArray(_ref7, 2);

            audioOutputLatency.delta = _ref72[0];
            audioOutputLatency.time = _ref72[1];

            audioOutputLatency.deltaSamples = audioOutputLatency.delta * app.audio.context.sampleRate;

            var _ref8 = app.audio.minPowerOfTwo(audioOutputLatency.deltaSamples);

            var _ref82 = _slicedToArray(_ref8, 1);

            audioOutputLatency.deltaSamplesPow2 = _ref82[0];

            this.display += "Audio output latency: " + audioOutputLatency.time + "; ∆ = " + audioOutputLatency.delta + " (" + audioOutputLatency.deltaSamples + " -> " + audioOutputLatency.deltaSamplesPow2 + ")" + "<br>";
          }

          if (typeof app.audio.context.getOutputTimestamp === "function") {
            var stamp = app.audio.context.getOutputTimestamp().contextTime;

            var audioStamp = {};

            var _ref9 = this.audioStampDelta.getTimeDelta(stamp);

            var _ref92 = _slicedToArray(_ref9, 2);

            audioStamp.delta = _ref92[0];
            audioStamp.time = _ref92[1];

            audioStamp.deltaSamples = audioStamp.delta * app.audio.context.sampleRate;

            var _ref10 = app.audio.minPowerOfTwo(audioStamp.deltaSamples);

            var _ref102 = _slicedToArray(_ref10, 1);

            audioStamp.deltaSamplesPow2 = _ref102[0];

            this.display += "Audio time stamp: " + audioStamp.time + "; ∆ = " + audioStamp.delta + " (" + audioStamp.deltaSamples + " -> " + audioStamp.deltaSamplesPow2 + ")" + "<br>";
          }

          var frame = {};

          var _ref11 = this.frameDelta.getTimeDelta(frameTime * 0.001);

          var _ref112 = _slicedToArray(_ref11, 2);

          frame.delta = _ref112[0];
          frame.time = _ref112[1];

          if (frame.time === 0) {
            frame.delta = 0;
          }

          this.display += "Animation Frame: " + frame.time + "; ∆ = " + frame.delta + " (" + frame.delta * app.audio.context.sampleRate + ")" + "<br>";

          var perf = {};

          var _ref12 = this.perfDelta.getTimeDelta(app.clock.getPerformanceTime());

          var _ref122 = _slicedToArray(_ref12, 2);

          perf.delta = _ref122[0];
          perf.time = _ref122[1];

          this.display += "Performance time: " + perf.time + "; ∆ = " + perf.delta + " (" + perf.delta * app.audio.context.sampleRate + ")" + "<br>" + "<br>";

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

},{"./audio.js":5,"./clock.js":6,"debug":1}]},{},[7]);
