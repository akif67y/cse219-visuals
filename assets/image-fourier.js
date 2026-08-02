/* Shared 2D Fourier helpers for the image-frequency teaching demos. */
(function (global) {
  "use strict";

  const TAU = Math.PI * 2;

  function Clamp(value, low = 0, high = 1) {
    return Math.max(low, Math.min(high, value));
  }

  function FFT1D(real, imag, inverse = false) {
    const length = real.length;
    for (let i = 1, j = 0; i < length; i++) {
      let bit = length >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    for (let span = 2; span <= length; span <<= 1) {
      const angle = (inverse ? TAU : -TAU) / span;
      const stepReal = Math.cos(angle);
      const stepImag = Math.sin(angle);
      for (let offset = 0; offset < length; offset += span) {
        let twiddleReal = 1;
        let twiddleImag = 0;
        for (let j = 0; j < span / 2; j++) {
          const evenReal = real[offset + j];
          const evenImag = imag[offset + j];
          const oddIndex = offset + j + span / 2;
          const oddReal = real[oddIndex] * twiddleReal - imag[oddIndex] * twiddleImag;
          const oddImag = real[oddIndex] * twiddleImag + imag[oddIndex] * twiddleReal;
          real[offset + j] = evenReal + oddReal;
          imag[offset + j] = evenImag + oddImag;
          real[oddIndex] = evenReal - oddReal;
          imag[oddIndex] = evenImag - oddImag;
          const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
          twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
          twiddleReal = nextReal;
        }
      }
    }

    if (inverse) {
      for (let i = 0; i < length; i++) {
        real[i] /= length;
        imag[i] /= length;
      }
    }
  }

  function Transform2D(real, imag, size, inverse = false) {
    const lineReal = new Float64Array(size);
    const lineImag = new Float64Array(size);

    for (let y = 0; y < size; y++) {
      const offset = y * size;
      for (let x = 0; x < size; x++) {
        lineReal[x] = real[offset + x];
        lineImag[x] = imag[offset + x];
      }
      FFT1D(lineReal, lineImag, inverse);
      for (let x = 0; x < size; x++) {
        real[offset + x] = lineReal[x];
        imag[offset + x] = lineImag[x];
      }
    }

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        lineReal[y] = real[y * size + x];
        lineImag[y] = imag[y * size + x];
      }
      FFT1D(lineReal, lineImag, inverse);
      for (let y = 0; y < size; y++) {
        real[y * size + x] = lineReal[y];
        imag[y * size + x] = lineImag[y];
      }
    }
  }

  function ComputeFFT2(values, size) {
    if (values.length !== size * size) throw new Error("Image dimensions do not match the FFT size.");
    const real = new Float64Array(values);
    const imag = new Float64Array(size * size);
    Transform2D(real, imag, size, false);
    return { real, imag, size };
  }

  function ComputeIFFT2(spectrum) {
    const real = new Float64Array(spectrum.real);
    const imag = new Float64Array(spectrum.imag);
    Transform2D(real, imag, spectrum.size, true);
    return real;
  }

  function FrequencyDistance(x, y, size) {
    const horizontal = Math.min(x, size - x);
    const vertical = Math.min(y, size - y);
    return Math.hypot(horizontal, vertical);
  }

  function CreateRadialMask(size, options = {}) {
    const pass = options.pass === "high" ? "high" : "low";
    const type = options.type === "hard" ? "hard" : "gaussian";
    const radius = Math.max(1, Number(options.radius) || 1);
    const softness = Clamp(Number(options.softness) || 0, 0, 40);
    const sigma = Math.max(0.75, radius * (0.55 + softness / 50));
    const mask = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distance = FrequencyDistance(x, y, size);
        let low = type === "hard" ? (distance <= radius ? 1 : 0) : Math.exp(-(distance * distance) / (2 * sigma * sigma));
        if (low < 0.0001) low = 0;
        mask[y * size + x] = pass === "low" ? low : 1 - low;
      }
    }
    return mask;
  }

  function TeachingNoisePeaks(size) {
    const scale = size / 256;
    const raw = [
      [41 * scale, 5 * scale],
      [-41 * scale, -5 * scale],
      [0, 54 * scale],
      [0, -54 * scale]
    ];
    return raw.map(([x, y]) => ({ x: (x + size) % size, y: (y + size) % size }));
  }

  function WrappedDistance(x, y, centerX, centerY, size) {
    const horizontal = Math.min(Math.abs(x - centerX), size - Math.abs(x - centerX));
    const vertical = Math.min(Math.abs(y - centerY), size - Math.abs(y - centerY));
    return Math.hypot(horizontal, vertical);
  }

  function CreateNotchMask(size, options = {}) {
    const width = Math.max(0.25, Number(options.width) || 0.75);
    const type = options.type === "gaussian" ? "gaussian" : "hard";
    const peaks = options.peaks || TeachingNoisePeaks(size);
    const mask = new Float32Array(size * size);
    mask.fill(1);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let keep = 1;
        for (const peak of peaks) {
          const distance = WrappedDistance(x, y, peak.x, peak.y, size);
          const notch = type === "hard"
            ? (distance <= width ? 0 : 1)
            : 1 - Math.exp(-(distance * distance) / (2 * width * width));
          keep = Math.min(keep, notch);
        }
        mask[y * size + x] = keep;
      }
    }
    return mask;
  }

  function ApplyMask(spectrum, mask) {
    const length = spectrum.size * spectrum.size;
    const real = new Float64Array(length);
    const imag = new Float64Array(length);
    for (let i = 0; i < length; i++) {
      real[i] = spectrum.real[i] * mask[i];
      imag[i] = spectrum.imag[i] * mask[i];
    }
    return { real, imag, size: spectrum.size };
  }

  function ShiftedIndex(x, y, size) {
    const sourceX = (x + size / 2) % size;
    const sourceY = (y + size / 2) % size;
    return sourceY * size + sourceX;
  }

  function PrepareCanvas(canvas, size) {
    canvas.width = size;
    canvas.height = size;
    return canvas.getContext("2d");
  }

  function RenderGray(canvas, values, options = {}) {
    const size = options.size || Math.round(Math.sqrt(values.length));
    const context = PrepareCanvas(canvas, size);
    const pixels = context.createImageData(size, size);
    const gain = Number(options.gain) || 1;
    const invert = Boolean(options.invert);
    const absolute = Boolean(options.absolute);
    const normalize = Boolean(options.normalize);
    let scale = 1;

    if (normalize) {
      let maximum = 0;
      for (let i = 0; i < values.length; i++) maximum = Math.max(maximum, absolute ? Math.abs(values[i]) : values[i]);
      scale = maximum > 1e-12 ? 1 / maximum : 1;
    }

    for (let i = 0; i < values.length; i++) {
      let value = absolute ? Math.abs(values[i]) : values[i];
      value = Clamp(value * scale * gain);
      if (invert) value = 1 - value;
      const gray = Math.round(value * 255);
      const pixel = i * 4;
      pixels.data[pixel] = gray;
      pixels.data[pixel + 1] = gray;
      pixels.data[pixel + 2] = gray;
      pixels.data[pixel + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
  }

  function RenderThreshold(canvas, values, options = {}) {
    const size = options.size || Math.round(Math.sqrt(values.length));
    const magnitudes = new Float64Array(values.length);
    let maximum = 0;
    for (let i = 0; i < values.length; i++) {
      magnitudes[i] = Math.abs(values[i]);
      maximum = Math.max(maximum, magnitudes[i]);
    }
    const threshold = Clamp(Number(options.threshold) || 0) * maximum;
    const binary = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) binary[i] = magnitudes[i] >= threshold ? 1 : 0;
    RenderGray(canvas, binary, { size, invert: options.invert });
  }

  function RenderSpectrum(canvas, spectrum, options = {}) {
    const size = spectrum.size;
    const context = PrepareCanvas(canvas, size);
    const pixels = context.createImageData(size, size);
    const logs = new Float64Array(size * size);
    let maximum = 0;
    for (let i = 0; i < logs.length; i++) {
      logs[i] = Math.log1p(Math.hypot(spectrum.real[i], spectrum.imag[i]));
      maximum = Math.max(maximum, logs[i]);
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const source = ShiftedIndex(x, y, size);
        const strength = maximum > 0 ? Math.pow(logs[source] / maximum, 0.58) : 0;
        const maskValue = options.mask ? options.mask[source] : 1;
        const pixel = (y * size + x) * 4;
        if (options.mask && options.overlay !== false) {
          pixels.data[pixel] = Math.round(255 * strength * (0.28 + 0.72 * maskValue));
          pixels.data[pixel + 1] = Math.round(255 * strength * (0.34 + 0.66 * maskValue));
          pixels.data[pixel + 2] = Math.round(255 * strength * (0.48 + 0.52 * maskValue) + 42 * maskValue);
        } else {
          const gray = Math.round(255 * strength);
          pixels.data[pixel] = gray;
          pixels.data[pixel + 1] = gray;
          pixels.data[pixel + 2] = gray;
        }
        pixels.data[pixel + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
  }

  function RenderMask(canvas, mask, size) {
    const context = PrepareCanvas(canvas, size);
    const pixels = context.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const value = mask[ShiftedIndex(x, y, size)];
        const pixel = (y * size + x) * 4;
        pixels.data[pixel] = Math.round(24 + 94 * value);
        pixels.data[pixel + 1] = Math.round(31 + 179 * value);
        pixels.data[pixel + 2] = Math.round(45 + 202 * value);
        pixels.data[pixel + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
  }

  function CanvasToGrayscale(sourceCanvas, size) {
    const working = document.createElement("canvas");
    const context = working.getContext("2d", { willReadFrequently: true });
    working.width = size;
    working.height = size;
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    const side = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - side) / 2;
    const sourceY = (sourceHeight - side) / 2;
    context.drawImage(sourceCanvas, sourceX, sourceY, side, side, 0, 0, size, size);
    const rgba = context.getImageData(0, 0, size, size).data;
    const gray = new Float32Array(size * size);
    for (let i = 0; i < gray.length; i++) {
      const offset = i * 4;
      gray[i] = (0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]) / 255;
    }
    return gray;
  }

  function CreateSample(sampleId = "shapes", size = 256) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = size;
    canvas.height = size;

    if (sampleId === "text") {
      const gradient = context.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, "#f8fafc");
      gradient.addColorStop(1, "#a8b0bf");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      context.fillStyle = "#172033";
      context.font = `900 ${Math.round(size * 0.19)}px system-ui`;
      context.textAlign = "center";
      context.fillText("CSE", size / 2, size * 0.43);
      context.fillText("219", size / 2, size * 0.65);
      context.strokeStyle = "#4b5563";
      context.lineWidth = Math.max(3, size / 48);
      context.strokeRect(size * 0.12, size * 0.17, size * 0.76, size * 0.58);
    } else if (sampleId === "rings") {
      const image = context.createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const radius = Math.hypot(x - size * 0.52, y - size * 0.48);
          const slow = 0.34 + 0.38 * x / size + 0.12 * y / size;
          const ring = radius > size * 0.18 && radius < size * 0.32 ? 0.24 : 0;
          const value = Clamp(slow + ring);
          const pixel = (y * size + x) * 4;
          image.data[pixel] = image.data[pixel + 1] = image.data[pixel + 2] = Math.round(value * 255);
          image.data[pixel + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      context.fillStyle = "#273143";
      context.fillRect(size * 0.12, size * 0.68, size * 0.34, size * 0.055);
    } else {
      const gradient = context.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, "#e7eaf0");
      gradient.addColorStop(1, "#767f90");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      context.fillStyle = "#263246";
      context.fillRect(size * 0.1, size * 0.16, size * 0.3, size * 0.28);
      context.fillStyle = "#f0f2f5";
      context.beginPath();
      context.arc(size * 0.68, size * 0.34, size * 0.18, 0, TAU);
      context.fill();
      context.fillStyle = "#4b5563";
      context.beginPath();
      context.moveTo(size * 0.18, size * 0.84);
      context.lineTo(size * 0.48, size * 0.48);
      context.lineTo(size * 0.76, size * 0.84);
      context.closePath();
      context.fill();
      context.strokeStyle = "#fff";
      context.lineWidth = Math.max(2, size / 80);
      for (let i = 0; i < 6; i++) {
        const y = size * (0.53 + i * 0.045);
        context.beginPath();
        context.moveTo(size * 0.79, y);
        context.lineTo(size * 0.93, y);
        context.stroke();
      }
    }
    return CanvasToGrayscale(canvas, size);
  }

  function AddTeachingNoise(values, amount, size, seed = 219, mode = "mixed") {
    let randomState = seed >>> 0;
    const random = () => {
      randomState = (1664525 * randomState + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    const strength = Clamp(amount, 0, 1);
    const noisy = new Float32Array(values.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x;
        const randomNoise = mode === "periodic" ? 0 : (random() + random() + random() - 1.5) * strength * 0.52;
        const periodic = (
          Math.sin(TAU * (41 * x + 5 * y) / size) +
          Math.sin(TAU * 54 * y / size)
        ) * strength * (mode === "periodic" ? 0.48 : 0.18);
        noisy[index] = values[index] + randomNoise + periodic;
      }
    }
    return noisy;
  }

  function Difference(first, second) {
    const output = new Float64Array(first.length);
    for (let i = 0; i < first.length; i++) output[i] = first[i] - second[i];
    return output;
  }

  function MeanSquaredError(first, second) {
    let sum = 0;
    for (let i = 0; i < first.length; i++) {
      const delta = first[i] - second[i];
      sum += delta * delta;
    }
    return sum / first.length;
  }

  function MeanMask(mask) {
    let sum = 0;
    for (let i = 0; i < mask.length; i++) sum += mask[i];
    return sum / mask.length;
  }

  global.ImageFourier = Object.freeze({
    AddTeachingNoise,
    ApplyMask,
    CanvasToGrayscale,
    Clamp,
    ComputeFFT2,
    ComputeIFFT2,
    CreateNotchMask,
    CreateRadialMask,
    CreateSample,
    Difference,
    MeanMask,
    MeanSquaredError,
    RenderGray,
    RenderMask,
    RenderSpectrum,
    RenderThreshold
  });
})(window);
