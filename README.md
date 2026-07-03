# LFM2.5 - WebGPU Reader + Q&A (Pinokio)

In-browser text generation powered by the [LiquidAI/LFM2.5](https://huggingface.co/collections/LiquidAI/lfm25) family via [transformers.js](https://huggingface.co/docs/transformers.js) and WebGPU. Paste long text, clean it into readable sections, summarize each section, and ask questions about the converted article without any server-side GPU.

## Model

A model-size dropdown in the UI lets you switch between:

| Model | Params | Browser ONNX model |
|---|---|---|
| LFM2.5 230M (fastest) | 0.2B | [onnx-community/LFM2.5-230M-ONNX](https://huggingface.co/onnx-community/LFM2.5-230M-ONNX) (q4) |
| LFM2.5 350M (default) | 0.4B | [onnx-community/LFM2.5-350M-ONNX](https://huggingface.co/onnx-community/LFM2.5-350M-ONNX) (q4) |
| LFM2.5 1.2B Instruct (best quality) | 1.2B | [LiquidAI/LFM2.5-1.2B-Instruct-ONNX](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX) (q4) |

Switching models reloads the worker and re-downloads the selected model on first use.

## Requirements

- A modern browser with **WebGPU** support (Chrome 113+, Edge 113+)
- No Python, no GPU server, no CUDA needed

## How It Works

1. Pinokio runs a static file server for the `app/` folder (see `start.js`).
2. A Web Worker loads the selected q4-quantized ONNX model from Hugging Face CDN using `transformers.js`.
3. Inference runs directly in the browser via WebGPU.
4. Tokens are streamed back to the UI in real time.
5. The model is cached in the browser after the first download.

## Getting Started (Pinokio)

1. **Install** — Run **Install** in the Pinokio sidebar for a short note on setup (no extra downloads are required).
2. **Start** — Run **Start** to launch the local HTTP server for `app/`.
3. **Open Web UI** — When the server is running, use **Open Web UI** to open the reader and Q&A interface.
4. Pick a model size from the dropdown; it downloads automatically on first use.

## Features

- Paste a full article or note and click **Convert**
- Cleanup removes URLs, markdown image syntax, HTML tags, and noisy spacing
- Converted text is split into sections with a **Summarize** button on each paragraph
- Floating bottom-right Q&A box answers questions using the converted text only
- Switch between LFM2.5 230M / 350M / 1.2B-Instruct without leaving the page

## Programmatic access

There is **no HTTP API** for model inference: generation runs only in the browser.

| Surface | Role |
|--------|------|
| **JavaScript** | UI and orchestration in `app/app.js`; model pipeline in `app/worker.js` (transformers.js `pipeline`, WebGPU). |
| **Python** | Not used by this app. |
| **curl** | Not applicable for inference; you can `curl` the static server URL only to fetch HTML/assets after **Start**. |

## Architecture

```
Pinokio (start.js → serve app/)
  └─ Browser loads app/index.html
       ├─ app/app.js (UI, model-select dropdown)
       └─ app/worker.js (transformers.js)
            └─ WebGPU inference (onnx-community/LFM2.5-*-ONNX or LiquidAI/LFM2.5-1.2B-Instruct-ONNX)
```
