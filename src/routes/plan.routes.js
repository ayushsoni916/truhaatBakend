const express = require('express')
const multer = require('multer');
const { createPlan, getPlans, purchasePlan, getSubAdminPlans, getAllAdminPlans, deletePlan, updatePlanBenefits, uploadMlmBanner, getMyPlanPurchases } = require('../controllers/plan.controller')
const { requireAuth } = require('../middleware/auth.middleware')

const planRouter = express.Router()

const upload = multer({ storage: multer.memoryStorage() });

planRouter.post('/', createPlan)
planRouter.get('/', requireAuth, getPlans)
planRouter.get('/getSubAdminPlans', getSubAdminPlans)
planRouter.post('/purchase', requireAuth, purchasePlan);
planRouter.get('/my-purchases', requireAuth, getMyPlanPurchases);

planRouter.get('/admin/all', getAllAdminPlans)
planRouter.delete('/:id', deletePlan);
planRouter.put('/:id/benefits', updatePlanBenefits);

planRouter.post('/admin/upload-banner', upload.single('file'), uploadMlmBanner);

module.exports = planRouter