const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const DB_PATH = path.join(ROOT_DIR, 'films.json');

/* ─────────────────────────────────────────────
   ADMIN PASSWORD
───────────────────────────────────────────── */

const ADMIN_PASS = 'your-real-password-here';

/* ─────────────────────────────────────────────
   CREATE REQUIRED FILES/FOLDERS
───────────────────────────────────────────── */

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, '[]', 'utf8');
}

/* ─────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────── */

app.use(cors());
app.use(express.json());

/* ONLY expose uploads publicly */
app.use('/uploads', express.static(UPLOADS_DIR));

/* ONLY expose frontend files */
app.use('/', express.static(PUBLIC_DIR));

/* ─────────────────────────────────────────────
   ADMIN AUTH CHECK
───────────────────────────────────────────── */

function checkAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];

  if (password !== ADMIN_PASS) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  next();
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDb(films) {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(films, null, 2),
    'utf8'
  );
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/* ─────────────────────────────────────────────
   MULTER STORAGE
───────────────────────────────────────────── */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '.mp4');

    const base = path.basename(
      file.originalname || 'video',
      ext
    );

    const safeBase =
      sanitizeFilename(base).slice(0, 80) || 'video';

    const id = crypto.randomUUID();

    cb(null, `${id}-${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype &&
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
      return;
    }

    cb(new Error('Only video files are allowed.'));
  }
});

/* ─────────────────────────────────────────────
   ROUTES
───────────────────────────────────────────── */

/* PUBLIC FILM LIST */
app.get('/api/films', (_req, res) => {
  const films = loadDb();

  const mapped = films.map((film) => ({
    ...film,
    streamUrl: `/uploads/${film.fileName}`
  }));

  res.json(mapped);
});

/* ADMIN UPLOAD */
app.post(
  '/api/films',
  checkAdmin,
  upload.single('video'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error: 'No file uploaded.'
      });

      return;
    }

    const films = loadDb();

    const titleInput =
      typeof req.body.title === 'string'
        ? req.body.title.trim()
        : '';

    const title =
      titleInput ||
      path.basename(
        req.file.originalname,
        path.extname(req.file.originalname)
      );

    const film = {
      id: crypto.randomUUID(),
      title,
      fileName: req.file.filename,
      size: formatSize(req.file.size),
      bytes: req.file.size,
      addedAt: Date.now()
    };

    films.push(film);

    saveDb(films);

    res.status(201).json({
      ...film,
      streamUrl: `/uploads/${film.fileName}`
    });
  }
);

/* ADMIN DELETE */
app.delete(
  '/api/films/:id',
  checkAdmin,
  (req, res) => {
    const films = loadDb();

    const index = films.findIndex(
      (film) => film.id === req.params.id
    );

    if (index < 0) {
      res.status(404).json({
        error: 'Film not found.'
      });

      return;
    }

    const [removed] = films.splice(index, 1);

    saveDb(films);

    const filePath = path.join(
      UPLOADS_DIR,
      removed.fileName
    );

    fs.unlink(filePath, () => {
      res.status(204).end();
    });
  }
);

/* ─────────────────────────────────────────────
   START SERVER
───────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(
    `StreamVault server running at http://localhost:${PORT}`
  );
});
