'use strict';

let app = window.app || {};

const debug = require('debug')('web-audio-clock');
app.audio = require('./audio.js');
app.clock = require('./clock.js');

app.Measure = class {
  constructor() {
    // this.request = null;
    this.count = 0;
    this.display = '';
    this.dateDelta = new app.clock.TimeDelta();
    this.audioBaseLatencyDelta = new app.clock.TimeDelta();
    this.audioOutputLatencyDelta = new app.clock.TimeDelta();
    this.audioTimeDelta = new app.clock.TimeDelta();
    this.audioStampDelta = new app.clock.TimeDelta();
    this.frameDelta = new app.clock.TimeDelta();
    this.perfDelta = new app.clock.TimeDelta();
  }

  init(request) {
    this.request = request;
    this.count = 10;
    this.display = '';
    if(this.request) {
      this.request( (frameTime) => { this.pick(frameTime); } );
    }
  }

  pick(frameTime = 0) {
    if(this.count -- > 0) {

      this.display += '++++++++++ ' + this.count + ' ++++++++++' + '<br>';
      const date = {};
      [date.delta, date.time]
        = this.dateDelta.getTimeDelta(Date.now() * 1e-3);

      this.display += 'Date: ' + date.time
        + '; ∆ = ' + date.delta
        + ' (' + (date.delta * app.audio.context.sampleRate) + ')' + '<br>';

      const audioTime = {};
      [audioTime.delta, audioTime.time]
        = this.audioTimeDelta.getTimeDelta(app.audio.context.currentTime);

      audioTime.deltaSamples = audioTime.delta * app.audio.context.sampleRate;
      [audioTime.deltaSamplesPow2, ] = app.audio.minPowerOfTwo(audioTime.deltaSamples);

      this.display += 'Audio context time: ' + audioTime.time
        + '; ∆ = ' + audioTime.delta
        + ' (' + audioTime.deltaSamples
        + ' -> ' + audioTime.deltaSamplesPow2 + ')' + '<br>';

      if(typeof app.audio.context.baseLatency === 'undefined') {
        document.querySelector('#base-latency')
          .innerHTML = 'Base latency: undefined';
      } else {
          const latency = app.audio.context.baseLatency;

        document.querySelector('#base-latency')
          .innerHTML = 'Base latency: '
          + latency
          + ' s';

        const audioBaseLatency = {};
        [audioBaseLatency.delta, audioBaseLatency.time]
          = this.audioBaseLatencyDelta.getTimeDelta(latency);

        audioBaseLatency.deltaSamples = audioBaseLatency.delta * app.audio.context.sampleRate;
        [audioBaseLatency.deltaSamplesPow2, ] = app.audio.minPowerOfTwo(audioBaseLatency.deltaSamples);

        this.display += 'Audio base latency: ' + audioBaseLatency.time
          + '; ∆ = ' + audioBaseLatency.delta
          + ' (' + audioBaseLatency.deltaSamples
          + ' -> ' + audioBaseLatency.deltaSamplesPow2 + ')' + '<br>';
      }

      if(typeof app.audio.context.outputLatency === 'undefined') {
        document.querySelector('#output-latency')
          .innerHTML = 'Output latency: undefined';
      } else {
        const latency = app.audio.context.outputLatency;

        document.querySelector('#output-latency')
          .innerHTML = 'Output latency: '
          + latency
          + ' s';

        const audioOutputLatency = {};
        [audioOutputLatency.delta, audioOutputLatency.time]
          = this.audioOutputLatencyDelta.getTimeDelta(latency);

        audioOutputLatency.deltaSamples = audioOutputLatency.delta * app.audio.context.sampleRate;
        [audioOutputLatency.deltaSamplesPow2, ] = app.audio.minPowerOfTwo(audioOutputLatency.deltaSamples);

        this.display += 'Audio output latency: ' + audioOutputLatency.time
          + '; ∆ = ' + audioOutputLatency.delta
          + ' (' + audioOutputLatency.deltaSamples
          + ' -> ' + audioOutputLatency.deltaSamplesPow2 + ')' + '<br>';
      }

      if(typeof app.audio.context.getOutputTimestamp === 'function') {
        const stamp = app.audio.context.getOutputTimestamp().contextTime;

        const audioStamp = {};
        [audioStamp.delta, audioStamp.time]
          = this.audioStampDelta.getTimeDelta(stamp);

        audioStamp.deltaSamples = audioStamp.delta * app.audio.context.sampleRate;
        [audioStamp.deltaSamplesPow2, ] = app.audio.minPowerOfTwo(audioStamp.deltaSamples);

        this.display += 'Audio time stamp: ' + audioStamp.time
          + '; ∆ = ' + audioStamp.delta
          + ' (' + audioStamp.deltaSamples
          + ' -> ' + audioStamp.deltaSamplesPow2 + ')' + '<br>';
      }

      const frame = {};
      [frame.delta, frame.time]
        = this.frameDelta.getTimeDelta(frameTime * 1e-3);
      if(frame.time === 0) {
        frame.delta = 0;
      }

      this.display += 'Animation Frame: ' + frame.time
        + '; ∆ = ' + frame.delta
        + ' (' + (frame.delta * app.audio.context.sampleRate) + ')' + '<br>';

      const perf = {};
      [perf.delta, perf.time]
        = this.perfDelta.getTimeDelta(app.clock.getPerformanceTime() );

      this.display += 'Performance time: ' + perf.time
        + '; ∆ = ' + perf.delta
        + ' (' + (perf.delta * app.audio.context.sampleRate) + ')' + '<br>'
        + '<br>';

      if(this.request) {
        this.request( (frameTime) => { this.pick(frameTime); } );
      }
    } else {
      document.querySelector('#measure').innerHTML =
        '∆ = seconds (samples -> buffer size)' + '<br><br>'
        + this.display;
    }
  }

};

app.measure = new app.Measure();

app.displayAudioTime = function(frameTime) {
  const d = new Date();
    document.querySelector('#date-time')
    .innerHTML = 'Date: ' + new Date().toString()
    + ' (' + d.getTime() + ')';

  document.querySelector('#audio-time')
    .innerHTML = 'Audio: '
    + app.clock.timeString(app.audio.context.currentTime);

  document.querySelector('#frame-time')
    .innerHTML = 'Frame: '
    + app.clock.timeString(frameTime * 1e-3);

  document.querySelector('#performance-time')
    .innerHTML = 'Performance: '
    + app.clock.timeString(app.clock.getPerformanceTime() );

  requestAnimationFrame(app.displayAudioTime);
};


app.init = function() {
  document.querySelector('#time-started')
    .innerHTML = 'Loaded ' + new Date().toString();

  app.audio.init();

  document.querySelector('#sample-rate')
    .innerHTML = 'Audio sample-rate: '
    + app.audio.context.sampleRate + ' Hz';

  document.querySelector('#active-raf')
    .onclick = function() {
      app.audio.triggerSound(app.audio.noiseBuffer);
      app.measure.init(requestAnimationFrame.bind(window));
    };

  document.querySelector('#active-timeout')
    .onclick = function() {
      app.audio.triggerSound(app.audio.noiseBuffer);
      app.measure.init(function(fun) { window.setTimeout(fun, 0); });
    };

  document.querySelector('#active-once')
    .onclick = function() {
      app.audio.triggerSound(app.audio.clickBuffer);
      if(app.measure.count <= 0) {
        app.measure.init();
      }
      app.measure.pick(0);
      document.querySelector('#measure').innerHTML = app.measure.display;
    };

};

window.addEventListener('DOMContentLoaded', function() {
  app.init();

  requestAnimationFrame(app.displayAudioTime);
});

window.app = app;
