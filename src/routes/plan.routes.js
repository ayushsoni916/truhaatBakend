const express = require('express')
const { createPlan, getPlans } = require('../controllers/plan.controller')

const planRouter = express.Router()

planRouter.post('/',createPlan)
planRouter.get('/',getPlans)

module.exports = planRouter