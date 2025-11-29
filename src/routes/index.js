const express = require('express')
const userRouter = require('./user.routes')
const authRoute = require('./auth.routes')
const planRouter = require('./plan.routes')
const router = express.Router()

router.use('/users', userRouter)
router.use('/auth', authRoute)
router.use('/plans', planRouter)

module.exports = router;