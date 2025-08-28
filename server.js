import express from "express";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import slugify from "slugify";
import mime from "mime-types";
import dotenv from "dotenv";
import os from "os";
import expressLayouts from "express-ejs-layouts";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // pakai service role key di Railway
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "videos";

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Views + static
const __dirname = path.resolve();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// baseUrl helper
app.use((req, res, next) => {
  res.locals.site = res.locals.site || {};
  res.locals.site.baseUrl = BASE_URL || `${req.protocol}://${req.get("host")}`;
  next();
});

// Upload temp (ke folder OS /tmp)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
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

// ---- Helpers (DB) ----
async function readVideos() {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("createdAt", { ascending: false });
  if (error) {
    console.error("readVideos error:", error);
    return [];
  }
  return data || [];
}
async function getVideoBySlug(slug) {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getVideoBySlug error:", error);
    return null;
  }
  return data;
}
async function insertVideo(row) {
  const { error } = await supabase.from("videos").insert([row]);
  if (error) throw error;
}
async function deleteVideoBySlug(slug) {
  const { data, error } = await supabase
    .from("videos")
    .delete()
    .eq("slug", slug)
    .select("file_path")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---- Admin guard ----
function checkAdmin(req, res, next) {
  const key = (req.query.key || req.body.key || req.get("x-admin-key") || "").trim();
  if (ADMIN_KEY && key === ADMIN_KEY) return next();
  return res.status(403).send("Forbidden: Admin key required");
}

// ---- Routes ----

// Home (publik) — daftar trailer
app.get("/", async (req, res) => {
  const videos = await readVideos();
  const isAdmin = (req.query.key || "") === ADMIN_KEY;

  res.render("home", {
    videos,
    isAdmin,
    adminKey: isAdmin ? req.query.key : "",
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

// Watch (URL unik)
app.get("/watch/:slug", async (req, res) => {
  const v = await getVideoBySlug(req.params.slug);
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

// Admin (protected)
app.get("/admin", checkAdmin, async (req, res) => {
  const videos = await readVideos();
  res.render("admin", {
    videos,
    adminKey: req.query.key,
    site: { title: "Admin • Upload", canonical: `${res.locals.site.baseUrl}/admin` }
  });
});

// Upload trailer → ke Supabase Storage + simpan metadata
app.post("/admin/upload", checkAdmin, upload.single("video"), async (req, res) => {
  try {
    const { title, description, fullUrl } = req.body;
    if (!title || !req.file) throw new Error("Judul & file wajib.");

    // buat slug unik
    let slug = slugify(title, { lower: true, strict: true });
    let exists = await getVideoBySlug(slug);
    let i = 2;
    const baseSlug = slug;
    while (exists) {
      slug = `${baseSlug}-${i++}`;
      exists = await getVideoBySlug(slug);
    }

    // upload ke storage
    const ext = mime.extension(req.file.mimetype) || "mp4";
    const filePath = `trailers/${Date.now()}_${slug}.${ext}`;
    const fileBuffer = await fs.readFile(req.file.path);

    const { error: upErr } = await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: true
      });
    if (upErr) throw upErr;

    // dapatkan URL publik
    const { data: pub } = supabase
      .storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filePath);
    const publicUrl = pub.publicUrl;

    // simpan metadata
    await insertVideo({
      slug,
      title: title.trim(),
      description: (description || "").trim(),
      file_path: filePath,
      url: publicUrl,
      fullUrl: (fullUrl || "").trim()
    });

    fs.remove(req.file.path).catch(() => {});

    const key = encodeURIComponent(req.query.key || req.body.key || "");
    res.redirect(`/admin?key=${key}`);
  } catch (err) {
    console.error(err);
    res.status(400).send(String(err.message || err));
  }
});

// Hapus trailer
app.post("/admin/delete/:slug", checkAdmin, async (req, res) => {
  try {
    const deleted = await deleteVideoBySlug(req.params.slug);
    if (deleted?.file_path) {
      await supabase.storage.from(SUPABASE_BUCKET).remove([deleted.file_path]).catch(() => {});
    }
    const key = encodeURIComponent(req.query.key || req.body.key || "");
    res.redirect(`/admin?key=${key}`);
  } catch (err) {
    console.error(err);
    res.status(400).send("Gagal hapus");
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
