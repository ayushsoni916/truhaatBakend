const express = require('express')
const { createPlan, getPlans, purchasePlan, getSubAdminPlans } = require('../controllers/plan.controller')
const { requireAuth } = require('../middleware/auth.middleware')

const planRouter = express.Router()

planRouter.post('/', createPlan)
planRouter.get('/',requireAuth ,getPlans)
planRouter.get('/getSubAdminPlans', getSubAdminPlans)
planRouter.post('/purchase', requireAuth, purchasePlan);

module.exports = planRouter