## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `GROQ_API_KEY` in `.env.local` or `.env` if you want model-assisted weekly reviews. Optional backup keys `GROQ_API_KEY_2` and `GROQ_API_KEY_3` are also supported. Restart the Vite dev server after changing them. If omitted, the app uses a deterministic local review builder.
3. Run the app:
   `npm run dev`
