class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      // MUST copy the buffer — the original gets recycled after process() returns
      this.port.postMessage(channelData.slice());
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
