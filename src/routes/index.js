const express = require('express')
const userRouter = require('./user.routes')
const authRoute = require('./auth.routes')
const planRouter = require('./plan.routes')
const adminRouter = require('./admin.routes')
const walletRouter = require('./wallet.routes')
const teamRouter = require('./team.routes')
const kycRouter = require('./kyc.routes')
const router = express.Router()

router.use('/users', userRouter)
router.use('/auth', authRoute)
router.use('/plans', planRouter)
router.use('/admin',adminRouter)
router.use('/wallet',walletRouter)
router.use('/team',teamRouter)
router.use('/kyc',kycRouter)

module.exports = router;