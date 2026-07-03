import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

let generator = null;
let currentAbortController = null;

self.addEventListener("message", async (e) => {
  const { type } = e.data;

  if (type === "abort") {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    return;
  }

  if (type === "load") {
    const modelId = e.data.modelId || "onnx-community/LFM2.5-350M-ONNX";
    generator = null;
    try {
      generator = await pipeline("text-generation", modelId, {
        dtype: "q4",
        device: "webgpu",
        progress_callback: (progress) => {
          if (progress.status === "progress") {
            self.postMessage({ type: "progress", progress: progress.progress });
          }
        },
      });
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message });
    }
  } else if (type === "generate") {
    if (!generator) {
      self.postMessage({ type: "error", message: "Model not loaded" });
      return;
    }

    const { generationId, task = "chat", options = {} } = e.data;

    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token) => {
          if (signal.aborted) return;
          self.postMessage({ type: "token", token, generationId, task });
        },
      });

      const output = await generator(e.data.messages, {
        max_new_tokens: options.max_new_tokens ?? 512,
        do_sample: options.do_sample ?? false,
        streamer,
        signal,
      });

      if (signal.aborted) return;

      const assistantMessage = output[0].generated_text.at(-1).content;
      self.postMessage({ type: "done", output: assistantMessage, generationId, task });
    } catch (err) {
      if (signal.aborted) return;
      self.postMessage({ type: "error", message: err.message, generationId, task });
    }
  }
});
