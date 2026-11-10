// Photo storage. Cloudinary when configured (recommended on Render: its disk is ephemeral),
// otherwise the local ./uploads folder (fine for demos and local development).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const cloudinaryEnabled = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

let cloudinary;
function getCloudinary() {
  if (!cloudinary) {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
  }
  return cloudinary;
}

/** Stores an image buffer and returns { url, sha256, bytes }. */
async function storePhoto(buffer, mimetype, tenantId) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const bytes = buffer.length;

  if (cloudinaryEnabled) {
    const result = await new Promise((resolve, reject) => {
      const stream = getCloudinary().uploader.upload_stream(
        { folder: `batirent/${tenantId}`, resource_type: 'image', public_id: sha256.slice(0, 24) },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(buffer);
    });
    return { url: result.secure_url, sha256, bytes };
  }

  const ym = new Date().toISOString().slice(0, 7);
  const dir = path.join(UPLOAD_ROOT, String(tenantId), ym);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${crypto.randomUUID()}.${EXT[mimetype] || 'jpg'}`;
  fs.writeFileSync(path.join(dir, file), buffer);
  return { url: `${config.publicApiUrl}/uploads/${tenantId}/${ym}/${file}`, sha256, bytes };
}

module.exports = { storePhoto, UPLOAD_ROOT, cloudinaryEnabled };
