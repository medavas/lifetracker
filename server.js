import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '@anthropic-ai/claude-agent-sdk';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Permissive CORS is fine here: this server is only ever reached over
// localhost or your private Tailscale tunnel, never the public internet.
app.use(cors());
app.use(express.json());

// --- Auth note ------------------------------------------------------------
// This backend authenticates through YOUR Claude subscription, not a billed
// API key. The Agent SDK reuses the Claude Code login on this machine, so
// there is nothing to put in .env for auth — you log in once with the CLI
// (see BACKEND_SETUP.md). This is only permitted for a personal project you
// run yourself; do NOT deploy this for other users. If you ever do, switch to
// API-key auth per Anthropic's usage policy.
// -------------------------------------------------------------------------

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('Missing required environment variable: MONGODB_URI');
  process.exit(1);
}

mongoose.connect(mongoUri);

const conversationSchema = new mongoose.Schema({
  userId: String,
  title: String,
  // Agent SDK session id — lets us resume prior context instead of replaying
  // the whole transcript each turn. The session log lives on this machine's
  // filesystem, so resume survives restarts as long as those files remain.
  sessionId: String,
  messages: [
    {
      role: String,
      content: String,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Conversation = mongoose.model('Conversation', conversationSchema);

const SYSTEM_PROMPT =
  'You are a supportive personal assistant embedded in the user\'s Stoa app. ' +
  'Help them reflect on their habits, journal entries, and goals. Keep replies concise, ' +
  'concrete, and encouraging. When they ask what to focus on, give a short prioritized list.';

// Run one conversational turn through the Agent SDK and return the assistant
// text plus the (possibly new) session id.
async function runTurn(message, resumeSessionId) {
  const options = {
    model: 'claude-opus-4-8',
    systemPrompt: SYSTEM_PROMPT,
    // Conversational assistant — no filesystem/agent tooling, single response.
    allowedTools: [],
    maxTurns: 1,
    // Don't inherit this machine's global Claude Code config / skills / CLAUDE.md.
    settingSources: [],
  };
  if (resumeSessionId) {
    options.resume = resumeSessionId;
  }

  let sessionId = resumeSessionId || null;
  let text = '';

  for await (const evt of query({ prompt: message, options })) {
    if (evt.type === 'system' && evt.session_id) {
      sessionId = evt.session_id;
    }
    if (evt.type === 'result') {
      // The result message exposes the final text as `result`; fall back to
      // reassembling text blocks if a future SDK version changes the shape.
      if (typeof evt.result === 'string') {
        text = evt.result;
      } else if (Array.isArray(evt.content)) {
        text = evt.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('');
      }
    }
  }

  return { text, sessionId };
}

app.post('/api/assist', async (req, res) => {
  try {
    const { userId, conversationId, message } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: 'Missing message or userId' });
    }

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = new Conversation({
        userId,
        title: message.slice(0, 50),
        messages: [],
      });
    }

    conversation.messages.push({ role: 'user', content: message });

    const { text, sessionId } = await runTurn(message, conversation.sessionId);
    const assistantMessage = text || 'Unable to parse response';

    conversation.sessionId = sessionId;
    conversation.messages.push({ role: 'assistant', content: assistantMessage });
    conversation.updatedAt = new Date();

    await conversation.save();

    res.json({
      conversationId: conversation._id,
      message: assistantMessage,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve the built PWA from the same origin as the API. Run `pnpm run build`
// first; then a single Tailscale tunnel to this port covers both the app and
// /api/assist (no CORS, no mixed content, and the phone can install the PWA
// over Tailscale's HTTPS). In desktop dev you don't build — you use the Vite
// dev server on :5173, which calls this backend cross-origin (hence CORS above).
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback for client-side routes — but never swallow the API.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
