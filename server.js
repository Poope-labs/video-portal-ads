import express from "express";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import slugify from "slugify";
import mime from "mime-types";
import dotenv from "dotenv";
import expressLayouts from "express-ejs-layouts";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/,"");

const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
await fs.ensureDir(DATA_DIR);
await fs.ensureDir(UPLOAD_DIR);

const DB_PATH = path.join(DATA_DIR, "videos.json");
if (!(await fs.pathExists(DB_PATH))) await fs.writeJSON(DB_PATH, []);

// Multer storage (trailer disimpan lokal)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype) || "mp4";
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 300 }, // 300MB
  fileFilter: (req, file, cb) => {
    const ok = ["video/mp4", "video/webm", "video/ogg"].includes(file.mimetype);
    cb(ok ? null : new Error("Format video harus mp4/webm/ogg"), ok);
  }
});

// Views + layouts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR)); // serve trailer files

// Helpers
async function readVideos() { return fs.readJSON(DB_PATH); }
async function writeVideos(v) { return fs.writeJSON(DB_PATH, v, { spaces: 2 }); }

// Middleware: set default meta
app.use((req, res, next) => {
  res.locals.site = res.locals.site || {};
  res.locals.site.baseUrl = BASE_URL || `${req.protocol}://${req.get("host")}`;
  next();
});

// Home
app.get("/", async (_req, res) => {
  const videos = (await readVideos()).sort((a, b) => b.createdAt - a.createdAt);
  res.render("home", {
    videos,
    site: {
      title: "Video Portal",
      description: "Trailer video + tonton full lewat Telegram",
      canonical: `${res.locals.site.baseUrl}/`,
      og: {
        title: "Video Portal",
        description: "Trailer video + tonton full lewat Telegram",
        url: `${res.locals.site.baseUrl}/`
      }
    }
  });
});

// Watch (URL unik per video)
app.get("/watch/:slug", async (req, res) => {
  const videos = await readVideos();
  const v = videos.find(x => x.slug === req.params.slug);
  if (!v) return res.status(404).send("Video tidak ditemukan");

  const shareUrl = `${res.locals.site.baseUrl}/watch/${v.slug}`;
  res.render("watch", {
    v,
    shareUrl,
    site: {
      title: v.title,
      description: v.description || "Tonton trailer, klik tombol untuk full video.",
      canonical: shareUrl,
      og: {
        title: v.title,
        description: v.description || "Tonton trailer, klik tombol untuk full video.",
        url: shareUrl
        // og:image bisa ditambah kalau punya poster; sementara kosong.
      }
    }
  });
});

// Admin
app.get("/admin", async (_req, res) => {
  const videos = (await readVideos()).sort((a, b) => b.createdAt - a.createdAt);
  res.render("admin", {
    videos,
    site: { title: "Admin • Upload", canonical: `${res.locals.site.baseUrl}/admin` }
  });
});

// Upload trailer + link full (Telegram)
app.post("/admin/upload", upload.single("video"), async (req, res) => {
  try {
    const { title, description, fullUrl } = req.body;
    if (!title || !req.file) throw new Error("Judul & file wajib.");

    // slug unik
    let slug = slugify(title, { lower: true, strict: true });
    const videos = await readVideos();
    const baseSlug = slug;
    let i = 2;
    while (videos.some(v => v.slug === slug)) slug = `${baseSlug}-${i++}`;

    const item = {
      id: Date.now(),
      slug,
      title: title.trim(),
      description: (description || "").trim(),
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,     // TRAILER di website
      fullUrl: (fullUrl || "").trim(),         // Link FULL (Telegram/bot)
      createdAt: Date.now()
    };

    videos.push(item);
    await writeVideos(videos);
    res.redirect(`/watch/${slug}`);
  } catch (err) {
    res.status(400).send(String(err.message || err));
  }
});

// Delete
app.post("/admin/delete/:slug", async (req, res) => {
  const videos = await readVideos();
  const idx = videos.findIndex(v => v.slug === req.params.slug);
  if (idx === -1) return res.redirect("/admin");
  const [v] = videos.splice(idx, 1);
  await writeVideos(videos);
  if (v?.filename) await fs.remove(path.join(UPLOAD_DIR, v.filename)).catch(() => {});
  res.redirect("/admin");
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
