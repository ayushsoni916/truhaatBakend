const express = require('express')
const { createPlan, getPlans, purchasePlan, getSubAdminPlans, getAllAdminPlans, deletePlan, updatePlanBenefits } = require('../controllers/plan.controller')
const { requireAuth } = require('../middleware/auth.middleware')

const planRouter = express.Router()

planRouter.post('/', createPlan)
planRouter.get('/', requireAuth, getPlans)
planRouter.get('/getSubAdminPlans', getSubAdminPlans)
planRouter.post('/purchase', requireAuth, purchasePlan);

planRouter.get('/admin/all', getAllAdminPlans)
planRouter.delete('/:id', deletePlan);
planRouter.put('/:id/benefits', updatePlanBenefits);

module.exports = planRouter