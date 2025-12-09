const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'];

  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized admin access" });
  }

  next();
};

module.exports = adminAuth;
