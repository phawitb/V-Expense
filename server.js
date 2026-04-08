import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();

// --- 1. CORS First ---
const allowedOrigins = [
  'http://localhost:5173',
  'https://v-expense.vercel.app',
  'https://v-expense-git-main-phawitbs-projects.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// --- 2. Payload Limit (Higher) ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Successfully connected to MongoDB Atlas'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// Schemas
const WalletConfigSchema = new mongoose.Schema({
  walletId: { type: String, required: true, unique: true },
  categories: { type: Array, default: [] }
});

const TransactionSchema = new mongoose.Schema({
  walletId: { type: String, required: true },
  item: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  date: { type: Date, default: Date.now },
  groupId: { type: String },
  shopName: { type: String },
  createdBy: { type: String },
  userName: { type: String },
  userPicture: { type: String }
});

const WalletConfig = mongoose.model('WalletConfig', WalletConfigSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// --- Auth Endpoint ---
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    res.json({ uid: payload.sub, email: payload.email, name: payload.name, picture: payload.picture });
  } catch (err) {
    res.status(401).json({ error: 'Invalid Google Token' });
  }
});

// --- API Endpoints ---
app.get('/api/wallet/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let config = await WalletConfig.findOne({ walletId: id });
    if (!config) config = await WalletConfig.create({ walletId: id, categories: [] });
    const transactions = await Transaction.find({ walletId: id }).sort({ date: -1 });
    res.json({ config, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wallet/:id/config', async (req, res) => {
  try {
    const config = await WalletConfig.findOneAndUpdate({ walletId: req.params.id }, { categories: req.body.categories }, { upsert: true, new: true });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wallet/:id/transactions', async (req, res) => {
  try {
    const txData = Array.isArray(req.body) ? req.body : [req.body];
    const dataWithId = txData.map(tx => ({ ...tx, walletId: req.params.id }));
    const result = await Transaction.insertMany(dataWithId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const result = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/group/:groupId', async (req, res) => {
  try {
    await Transaction.deleteMany({ groupId: req.params.groupId });
    res.json({ message: 'Group Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/wallet/:id/reset', async (req, res) => {
  try {
    await Transaction.deleteMany({ walletId: req.params.id });
    await WalletConfig.findOneAndDelete({ walletId: req.params.id });
    res.json({ message: 'Reset Successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.post('/api/ai/gemini', async (req, res) => {
  const { payload } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'AI Error' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend Server running on port ${PORT}`));
