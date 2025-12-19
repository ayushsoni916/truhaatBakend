const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  console.log('Admin auth key:', key);
  console.log('Expected key:', process.env.ADMIN_SECRET_KEY);

  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized admin access" });
  }

  next();
};

module.exports = adminAuth;
