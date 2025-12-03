const express = require('express')
const { createPlan, getPlans, purchasePlan } = require('../controllers/plan.controller')
const { requireAuth } = require('../middleware/auth.middleware')

const planRouter = express.Router()

planRouter.post('/',createPlan)
planRouter.get('/',getPlans)
planRouter.post('/purchase', requireAuth, purchasePlan);

module.exports = planRouter