const rateLimit = require("express-rate-limit");
const { supabaseAdmin } = require("./supabaseAdmin");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Rate limit terlampaui." },
});

function getBearerToken(headerValue) {
  if (!headerValue) return "";
  const [prefix, token] = headerValue.split(" ");
  if (prefix !== "Bearer" || !token) return "";
  return token.trim();
}

async function resolveProfileByAuthUser(user) {
  const userId = user?.id;
  if (!userId) return null;

  let { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id,school_id,full_name,role,status,email")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (profile) return profile;

  const profileIdFromMeta = user?.user_metadata?.profile_id;
  if (profileIdFromMeta) {
    const byMeta = await supabaseAdmin
      .from("profiles")
      .select("id,school_id,full_name,role,status,email")
      .eq("id", profileIdFromMeta)
      .maybeSingle();
    if (byMeta.error) throw byMeta.error;
    if (byMeta.data) return byMeta.data;
  }

  const email = user?.email;
  if (email) {
    const byEmail = await supabaseAdmin
      .from("profiles")
      .select("id,school_id,full_name,role,status,email")
      .eq("email", email)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    if (byEmail.data) return byEmail.data;
  }

  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ message: "Token auth tidak ditemukan." });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ message: "Token auth tidak valid." });
    }

    const profile = await resolveProfileByAuthUser(userData.user);
    if (!profile) {
      return res.status(403).json({ message: "Profil user tidak ditemukan." });
    }
    if (String(profile.status || "").toLowerCase() !== "active") {
      return res.status(403).json({ message: "Akun tidak aktif." });
    }

    req.user = userData.user;
    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const role = (req.profile?.role || "").toLowerCase();
    if (role === "owner") {
      return next();
    }
    const ok = roles.some((r) => role.includes(r));
    if (!ok) return res.status(403).json({ message: "Akses ditolak." });
    next();
  };
}

async function requireApiKey(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);
    const schoolId = req.headers["x-school-id"];
    if (!token || !schoolId) {
      return res.status(401).json({ message: "Authorization dan X-School-ID wajib diisi." });
    }

    const { data, error } = await supabaseAdmin
      .from("schools")
      .select("id,name,status,api_key")
      .eq("id", schoolId)
      .maybeSingle();
    if (error || !data) return res.status(401).json({ message: "Sekolah tidak valid." });
    if (data.api_key !== token) return res.status(401).json({ message: "API key tidak valid." });
    if (String(data.status || "").toLowerCase() !== "active") {
      return res.status(403).json({ message: "Sekolah tidak aktif." });
    }

    req.school = data;
    next();
  } catch (error) {
    next(error);
  }
}

async function auditLog(req, _res, next) {
  req.on("finish", async () => {
    try {
      const schoolId = req.profile?.school_id || req.school?.id || req.headers["x-school-id"] || null;
      if (!schoolId) return;
      await supabaseAdmin.from("api_logs").insert({
        school_id: schoolId,
        endpoint: req.originalUrl,
        method: req.method,
        status_code: _res.statusCode,
        ip_address: req.ip,
      });
    } catch (_error) {
      // silent logging error
    }
  });
  next();
}

module.exports = {
  loginLimiter,
  publicLimiter,
  requireAuth,
  requireRoles,
  requireApiKey,
  auditLog,
  resolveProfileByAuthUser,
};
