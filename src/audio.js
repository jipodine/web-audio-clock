/*global AudioContext */

let audio = {};

audio.getTime = function () {
  return audio.context.currentTime;
};

audio.dBToLin = function(dBValue) {
  return Math.pow(10, dBValue / 20);
};

audio.minPowerOfTwo = function(value, bitMax = 16, precision = 1e-5) {
  let power = 0;
  let bit = 0;

  let v = Math.abs(value);
  if(v > precision
     && Math.abs(v - Math.round(v)) < precision) {
    power = 1;
    v = Math.round(v) * 0.5;
    while(v % 1 < precision && bit < bitMax) {
      power *= 2;
      ++ bit;
      v *= 0.5;
    }
  }
  return [power, bit];
};

let generateClickBuffer = function() {
  const length = 2;
  const channels = 1;
  const gain = -10; // dB

  let buffer = audio.context.createBuffer(channels, length,
                                          audio.context.sampleRate);
  let data = buffer.getChannelData(0);

  const amplitude = audio.dBToLin(gain);
  data[0] = amplitude;
  data[1] = (- amplitude);

  return buffer;
};

const generateNoiseBuffer = function () {
  const duration = 0.2; // second
  const gain = -30; // dB
  
  const length = duration * audio.context.sampleRate;
  const amplitude = audio.dBToLin(gain);
  const channelCount = audio.context.destination.channelCount;
  let buffer = audio.context.createBuffer(channelCount, length,
                                          audio.context.sampleRate);
  for(let c = 0; c < channelCount; ++c) {
    let data = buffer.getChannelData(c);
    for(let i = 0; i < length; ++i) {
      data[i] = amplitude * (Math.random() * 2 + 1);
    }
  }

  return buffer;
};


audio.triggerSound = function(buffer) {
  let bufferSource = audio.context.createBufferSource();
  bufferSource.buffer = buffer;
  bufferSource.connect(audio.context.destination);
  bufferSource.start(0);
};

audio.started = false;
audio.init = function () {
  if (! audio.started
      && typeof audio.context !== 'undefined') {
    return;
  }
  try {
    audio.context = new AudioContext();
  } catch (e) {
    window.alert("This browser doesn't support the Web Audio API."
                 + "Try the latest version of Chrome or Firefox.");
    return;
  }

  audio.clickBuffer = generateClickBuffer();
  audio.noiseBuffer = generateNoiseBuffer();

  audio.started = true;
};

module.exports = exports = audio;
