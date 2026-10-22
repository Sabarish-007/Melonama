# SmartMole — Groq Edition

A professional skin lesion analyzer powered by **Groq API** (Llama 4 Scout vision model).

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and add your Groq API key:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and set:
   ```
   GROQ_API_KEY="your_groq_api_key_here"
   ```
   Get a free API key at: https://console.groq.com/keys

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser.

## What Changed (Gemini → Groq)

| Area | Before | After |
|---|---|---|
| API Provider | Google Gemini | Groq |
| Model | `gemini-2.0-flash` | `meta-llama/llama-4-scout-17b-16e-instruct` |
| Endpoint | `generativelanguage.googleapis.com` | `api.groq.com/openai/v1/chat/completions` |
| Auth | `?key=` query param | `Authorization: Bearer` header |
| Request format | Gemini `contents[]` | OpenAI-compatible `messages[]` |
| Response parsing | `candidates[0].content.parts[0].text` | `choices[0].message.content` |
| Env variable | `GEMINI_API_KEY` | `GROQ_API_KEY` |
| SDK dependency | `@google/genai` | `groq-sdk` |

## Medical Disclaimer

For informational purposes only. Always consult a qualified dermatologist for a formal diagnosis. This tool is not a medical device.
