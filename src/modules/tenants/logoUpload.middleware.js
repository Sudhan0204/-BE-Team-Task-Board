import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ApiError } from '../../utils/ApiError.js';

const LOGO_DIR = path.resolve(process.cwd(), 'uploads', 'logos');
if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOGO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const randomId = crypto.randomBytes(12).toString('hex');
    cb(null, `logo-${Date.now()}-${randomId}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        'Invalid logo file format. Allowed formats: PNG, JPG, JPEG, WEBP, GIF.'
      ),
      false
    );
  }
};

export const uploadCompanyLogo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});

export default uploadCompanyLogo;
