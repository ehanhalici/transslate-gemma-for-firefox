# Translate Gemma for Firefox

A Firefox browser extension paired with a lightweight Python backend server that enables real-time, LLM-powered text translation directly inside your browser. It supports translations leveraging local Hugging Face models or any OpenAI-compatible API endpoint (such as Ollama or local LLM servers).

## Features

* **Firefox WebExtension Integration:** Easily translate selected text on any webpage via a minimal content script interface.
* **Dual-Backend Support:** * Local translation via Hugging Face (`common_huggingface.py`).
  * OpenAI-compatible API interaction (`common_openai.py`) for hosting local models like Gemma via Ollama.
* **Fast Python Backend:** Powered by a modern, high-performance Python server (`main_server.py`).
* **CLI Client:** Includes a terminal-based interface (`main_terminal.py`) for quick translation tasks or debugging.
* **Nix OS Support:** Built-in `shell.nix` configuration ensuring a fully reproducible development environment.

## Repository Structure


```

├── firefox-translate-ui/    # Firefox WebExtension (manifest, content/background scripts)
├── common_huggingface.py    # Hugging Face model integration
├── common_openai.py         # OpenAI-compatible API client logic
├── main_server.py           # Backend server handling translation requests
├── main_terminal.py         # Terminal-based client interface
├── pyproject.toml / uv.lock # Python dependency management configuration
└── shell.nix                # Nix shell environment configuration

```

## Prerequisites

* Firefox Browser
* Python >= 3.12
* [uv](https://github.com/astral-sh/uv) (Fast Python package installer and resolver)
* A running LLM/Translation backend (e.g., Ollama with Gemma installed, or Hugging Face setup)

## Installation & Setup

### 1. Setup the Backend Server

Clone this repository and navigate to the project directory:

```bash
cd transslate-gemma-for-firefox

```

Install dependencies using `uv`:

```bash
uv sync

```

*(Optional for NixOS users: Run `nix-shell` to enter the pre-configured development environment with Python and required system libraries).*

Start the translation server:

```bash
python main_server.py

```

### 2. Load the Firefox Extension

1. Open Firefox and navigate to `about:debugging`.
2. Click on **"This Firefox"** in the left sidebar.
3. Click on **"Load Temporary Add-on..."**.
4. Navigate to the `firefox-translate-ui` directory in this repository and select the `manifest.json` file.

## Usage

1. Ensure your backend server (`main_server.py`) is running.
2. Highlight any text on a webpage within Firefox.
3. Use the extension interface/shortcut to instantly translate the highlighted content via your configured Gemma/LLM backend.
4. Alternatively, use the terminal interface for direct translations:
```bash
python main_terminal.py --text "Text to translate"

```
