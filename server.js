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
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// paths
const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
await fs.ensureDir(DATA_DIR);
await fs.ensureDir(UPLOAD_DIR);

// tiny DB
const DB_PATH = path.join(DATA_DIR, "videos.json");
if (!(await fs.pathExists(DB_PATH))) await fs.writeJSON(DB_PATH, []);

// upload (local trailer)
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
  limits: { fileSize: 1024 * 1024 * 300 },
  fileFilter: (req, file, cb) => {
    const ok = ["video/mp4", "video/webm", "video/ogg"].includes(file.mimetype);
    cb(ok ? null : new Error("Format video harus mp4/webm/ogg"), ok);
  }
});

// views + static
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

// helpers
async function readVideos() { return fs.readJSON(DB_PATH); }
async function writeVideos(v) { return fs.writeJSON(DB_PATH, v, { spaces: 2 }); }

// baseUrl helper
app.use((req, res, next) => {
  res.locals.site = res.locals.site || {};
  res.locals.site.baseUrl = BASE_URL || `${req.protocol}://${req.get("host")}`;
  next();
});

function checkAdmin(req, res, next) {
  const key = (req.query.key || req.body.key || req.get("x-admin-key") || "").trim();
  if (process.env.ADMIN_KEY && key === process.env.ADMIN_KEY) return next();
  return res.status(403).send("Forbidden: Admin key required");
}
// -----------------------------------

// HOME (publik) — tanpa form upload
app.get("/", async (req, res) => {
  const videos = (await readVideos()).sort((a, b) => b.createdAt - a.createdAt);

  // deteksi admin dari query key (biar bisa munculin tombol Admin kecil)
  const isAdmin = (req.query.key || "") === (process.env.ADMIN_KEY || "");

  res.render("home", {
    videos,
    isAdmin,
    adminKey: isAdmin ? req.query.key : "", // dipakai untuk link /admin
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
// WATCH (URL unik)
app.get("/watch/:slug", async (req, res) => {
  const videos = await readVideos();
  const v = videos.find(x => x.slug === req.params.slug);
  if (!v) return res.status(404).send("Video tidak ditemukan");

  const shareUrl = `${res.locals.site.baseUrl}/watch/${v.slug}`;
  const isAdmin = (req.query.admin === "1") || ((req.query.key || "") === ADMIN_KEY);

  res.render("watch", {
    v,
    shareUrl,
    isAdmin,
    site: {
      title: v.title,
      description: v.description || "Tonton trailer, klik tombol untuk full video.",
      canonical: shareUrl,
      og: {
        title: v.title,
        description: v.description || "Tonton trailer, klik tombol untuk full video.",
        url: shareUrl
      }
    }
  });
});

// ADMIN (protected)
app.get("/admin", checkAdmin, async (req, res) => {
  const videos = (await readVideos()).sort((a, b) => b.createdAt - a.createdAt);
  res.render("admin", {
    videos,
    adminKey: req.query.key, // biar form/action bisa ikut bawa key
    site: { title: "Admin • Upload", canonical: `${res.locals.site.baseUrl}/admin` }
  });
});

app.post("/admin/upload", checkAdmin, upload.single("video"), async (req, res) => {
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
      url: `/uploads/${req.file.filename}`, // trailer file
      fullUrl: (fullUrl || "").trim(),     // link FULL (Telegram/bot)
      createdAt: Date.now()
    };

    videos.push(item);
    await writeVideos(videos);

    // balik ke admin dengan key
    const key = encodeURIComponent(req.body.key || "");
    res.redirect(`/admin?key=${key}`);
  } catch (err) {
    res.status(400).send(String(err.message || err));
  }
});

app.post("/admin/delete/:slug", checkAdmin, async (req, res) => {
  const videos = await readVideos();
  const idx = videos.findIndex(v => v.slug === req.params.slug);
  if (idx !== -1) {
    const [v] = videos.splice(idx, 1);
    await writeVideos(videos);
    if (v?.filename) await fs.remove(path.join(UPLOAD_DIR, v.filename)).catch(() => {});
  }
  const key = encodeURIComponent(req.body.key || req.query.key || "");
  res.redirect(`/admin?key=${key}`);
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
