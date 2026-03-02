const express = require('express');
const router = express.Router();
const multer = require('multer');
const { addBanner, getBanners, deleteBanner } = require('../controllers/banner.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/add', upload.single('image'), addBanner);
router.get('/all', getBanners);
router.delete('/:id', deleteBanner);

module.exports = router;