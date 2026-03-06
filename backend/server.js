const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'readings.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    systolic INTEGER NOT NULL,
    diastolic INTEGER NOT NULL,
    pulse INTEGER NOT NULL,
    symptoms TEXT DEFAULT '-',
    consumed TEXT DEFAULT '-',
    truread TEXT DEFAULT '-',
    notes TEXT DEFAULT '-',
    timestamp INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date, time, systolic, diastolic, pulse)
  );
  CREATE INDEX IF NOT EXISTS idx_readings_user_timestamp ON readings(user_id, timestamp);
`);

app.use(cors());
app.use(express.json());

// Serve React static files in production
// Resolve static path: Docker puts build at /app/frontend/build, dev at ../frontend/build
const staticPath = fs.existsSync(path.join(__dirname, 'frontend', 'build'))
  ? path.join(__dirname, 'frontend', 'build')
  : path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

// Multer config for CSV uploads
const upload = multer({ storage: multer.memoryStorage() });

// Parse OMRON CSV content
function parseOmronCSV(text) {
  const lines = text.split('\n');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV fields that might contain commas in quotes
    const values = line.split(',');
    const dateStr = values[0]?.trim();
    const timeStr = values[1]?.trim();
    const sys = parseInt(values[2]);
    const dia = parseInt(values[3]);
    const pulse = parseInt(values[4]);

    if (!dateStr || !timeStr || isNaN(sys) || isNaN(dia) || isNaN(pulse)) continue;

    const fullDate = new Date(`${dateStr} ${timeStr}`);
    if (isNaN(fullDate.getTime())) continue;

    records.push({
      date: dateStr,
      time: timeStr,
      systolic: sys,
      diastolic: dia,
      pulse: pulse,
      symptoms: values[5]?.trim() || '-',
      consumed: values[6]?.trim() || '-',
      truread: values[7]?.trim() || '-',
      notes: values[8]?.trim() || '-',
      timestamp: fullDate.getTime()
    });
  }

  return records;
}

// GET /api/readings - Fetch all readings
app.get('/api/readings', (req, res) => {
  const userId = req.query.user_id || 1;
  const rows = db.prepare(
    'SELECT * FROM readings WHERE user_id = ? ORDER BY timestamp ASC'
  ).all(userId);
  res.json(rows);
});

// GET /api/stats - Fetch summary stats
app.get('/api/stats', (req, res) => {
  const userId = req.query.user_id || 1;
  const row = db.prepare(`
    SELECT
      COUNT(*) as count,
      ROUND(AVG(systolic)) as avgSys,
      MAX(systolic) as maxSys,
      MIN(systolic) as minSys,
      ROUND(AVG(diastolic)) as avgDia,
      MAX(diastolic) as maxDia,
      MIN(diastolic) as minDia,
      ROUND(AVG(pulse)) as avgPulse,
      MAX(pulse) as maxPulse,
      MIN(pulse) as minPulse
    FROM readings WHERE user_id = ?
  `).get(userId);
  res.json(row);
});

// POST /api/upload - Upload CSV, deduplicate, store new records
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.body.user_id || 1;
  const text = req.file.buffer.toString('utf-8');
  const records = parseOmronCSV(text);

  if (records.length === 0) {
    return res.status(400).json({ error: 'No valid records found in CSV' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO readings (user_id, date, time, systolic, diastolic, pulse, symptoms, consumed, truread, notes, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((recs) => {
    let inserted = 0;
    for (const r of recs) {
      const result = insert.run(
        userId, r.date, r.time, r.systolic, r.diastolic, r.pulse,
        r.symptoms, r.consumed, r.truread, r.notes, r.timestamp
      );
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  const inserted = insertMany(records);

  res.json({
    message: `Processed ${records.length} records. ${inserted} new records added, ${records.length - inserted} duplicates skipped.`,
    total_in_file: records.length,
    new_records: inserted,
    duplicates_skipped: records.length - inserted
  });
});

// DELETE /api/readings - Clear all readings
app.delete('/api/readings', (req, res) => {
  const userId = req.query.user_id || 1;
  const result = db.prepare('DELETE FROM readings WHERE user_id = ?').run(userId);
  res.json({ message: `Deleted ${result.changes} records.`, deleted: result.changes });
});

// DELETE /api/readings/range - Clear readings in a date range
app.delete('/api/readings/range', (req, res) => {
  const userId = req.query.user_id || 1;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Both "from" and "to" query parameters are required (as Unix timestamps in ms).' });
  }

  const fromTs = parseInt(from);
  const toTs = parseInt(to);

  if (isNaN(fromTs) || isNaN(toTs)) {
    return res.status(400).json({ error: 'Invalid timestamp values.' });
  }

  const result = db.prepare(
    'DELETE FROM readings WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?'
  ).run(userId, fromTs, toTs);

  res.json({ message: `Deleted ${result.changes} records in range.`, deleted: result.changes });
});

// Catch-all: serve React app for any non-API route
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vital Analytics API running on port ${PORT}`);
});
