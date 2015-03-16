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
    this.audioDelta = new app.clock.TimeDelta();
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
      let date = {};
      [date.time, date.delta]
        = this.dateDelta.getTimeDelta(Date.now() * 1e-3);

      let audio = {};
      [audio.time, audio.delta]
        = this.audioDelta.getTimeDelta(app.audio.context.currentTime);

      audio.deltaSamples = audio.delta * app.audio.context.sampleRate;
      [audio.deltaSamplesPow2, ] = app.audio.minPowerOfTwo(audio.deltaSamples);

      let frame = {};
      [frame.time, frame.delta]
        = this.frameDelta.getTimeDelta(frameTime * 1e-3);
      if(frame.time === 0) {
        frame.delta = 0;
      }

      let perf = {};
      [perf.time, perf.delta]
        = this.perfDelta.getTimeDelta(app.clock.getPerformanceTime() );

      this.display
        += '++++++++++ ' + this.count + ' ++++++++++' + '<br>'
        + 'Date: ' + date.time
        + '; ∆ = ' + date.delta
        + ' (' + (date.delta * app.audio.context.sampleRate) + ')' + '<br>'
        + 'Audio: ' + audio.time
        + '; ∆ = ' + audio.delta
        + ' (' + audio.deltaSamples
        + ' -> ' + audio.deltaSamplesPow2 + ')' + '<br>'
        + 'Frame: ' + frame.time
        + '; ∆ = ' + frame.delta
        + ' (' + (frame.delta * app.audio.context.sampleRate) + ')' + '<br>'
        + 'Perf.: ' + perf.time
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
