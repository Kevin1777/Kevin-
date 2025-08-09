import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5174;
app.use(cors());
app.use(express.json({limit: '10mb'}));

const upload = multer({ storage: multer.memoryStorage() });

// Helpers
const getUser = (username='demo') => {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  return row;
};

// Simple heuristic writing/translation evaluator
function evaluateText(text, target='general') {
  const issues = [];
  const suggestions = [];

  if (!text || text.trim().length === 0) {
    return { score: 0, issues: ['Empty submission'], suggestions: ['Write at least 80 words.'] };
  }

  const words = text.trim().split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(Boolean);

  if (words.length < 60) {
    issues.push('Too short for CET writing (aim 120-150 words).');
    suggestions.push('Try to reach at least 120 words.');
  }
  if (/(very\s+){2,}/i.test(text)) {
    issues.push('Repetition of intensifiers (e.g., "very very").');
    suggestions.push('Replace one "very" with a stronger adjective.');
  }
  if (/[a-z]{1}\s+(people|research|environment)\s+is\b/i.test(text)) {
    issues.push('Subject-verb agreement likely wrong.');
    suggestions.push('Ensure plural subjects take plural verbs.');
  }
  if (!/[,;:—-]/.test(text)) {
    suggestions.push('Vary punctuation (use commas/semicolons) for flow.');
  }
  if (!/however|moreover|therefore|in addition|on the one hand|on the other hand/i.test(text)) {
    suggestions.push('Use discourse markers: however, moreover, therefore, etc.');
  }

  // crude lexical variety metric
  const uniq = new Set(words.map(w=>w.toLowerCase().replace(/[^a-z']/g,'')));
  const variety = uniq.size / Math.max(words.length,1);
  let score = 60 + Math.min(20, Math.floor(variety*40)); // 60-80 based on variety

  // penalties
  score -= Math.min(15, Math.max(0, 120 - words.length) * 0.1);
  if (issues.length) score -= Math.min(10, issues.length * 3);

  // clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, issues, suggestions };
}

// Speaking evaluator based on duration and size
function evaluateSpeaking(fileBuffer, durationSecGuess) {
  let score = 50;
  if (durationSecGuess >= 20 && durationSecGuess <= 90) score += 25; // ideal range
  else if (durationSecGuess >= 12) score += 10;
  const kb = fileBuffer.length / 1024;
  if (kb > 50) score += 10; // assume contains speech
  score = Math.min(100, Math.round(score));
  const feedback = [
    'Aim for 1 minute; structure as: opening → two points → conclusion.',
    'Articulate linking words: firstly, furthermore, finally.'
  ];
  return { score, feedback };
}

// Routes
app.get('/api/ping', (req,res)=> res.json({ok:true, time: new Date().toISOString()}));

app.post('/api/login', (req,res)=>{
  const { username='demo' } = req.body || {};
  const user = getUser(username);
  if(!user) return res.status(400).json({error:'User not found'});
  res.json({user});
});

app.get('/api/exercises', (req,res)=>{
  const user = getUser();
  const rows = db.prepare("SELECT * FROM exercises WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(user.id);
  res.json({items: rows});
});

app.post('/api/submit/text', (req,res)=>{
  const { type='writing', text } = req.body || {};
  const user = getUser();
  const { score, issues, suggestions } = evaluateText(text, type);
  const payload = JSON.stringify({ text });
  const feedback = JSON.stringify({ issues, suggestions });
  const stmt = db.prepare("INSERT INTO exercises(user_id, type, payload, score, feedback) VALUES(?,?,?,?,?)");
  const info = stmt.run(user.id, type, payload, score, feedback);
  res.json({ id: info.lastInsertRowid, score, issues, suggestions });
});

app.post('/api/submit/speaking', upload.single('audio'), (req,res)=>{
  const user = getUser();
  const duration = Number(req.body?.duration || 0);
  if(!req.file) return res.status(400).json({error:'No audio'});
  const { score, feedback } = evaluateSpeaking(req.file.buffer, duration);
  const payload = JSON.stringify({ filename: req.file.originalname, duration });
  const stmt = db.prepare("INSERT INTO exercises(user_id, type, payload, score, feedback) VALUES(?,?,?,?,?)");
  const info = stmt.run(user.id, 'speaking', payload, score, JSON.stringify({ feedback }));
  res.json({ id: info.lastInsertRowid, score, feedback });
});

app.get('/api/dashboard', (req,res)=>{
  const user = getUser();
  const stats = db.prepare("SELECT type, COUNT(*) as cnt, AVG(score) as avg_score FROM exercises WHERE user_id = ? GROUP BY type").all(user.id);
  const recent = db.prepare("SELECT id, type, score, created_at FROM exercises WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").all(user.id);
  res.json({ stats, recent });
});

app.listen(PORT, ()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});
