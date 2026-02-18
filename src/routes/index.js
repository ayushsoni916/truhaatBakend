const express = require('express')
const userRouter = require('./user.routes')
const authRoute = require('./auth.routes')
const planRouter = require('./plan.routes')
const adminRouter = require('./admin.routes')
const walletRouter = require('./wallet.routes')
const teamRouter = require('./team.routes')
const kycRouter = require('./kyc.routes')
const categoryRouter = require('./store/category.routes')
const productRouter = require('./store/product.routes')
const cartRouter = require('./store/store.routes.js')
const shopRouter = require('./shop.routes.js')
const router = express.Router()

router.use('/users', userRouter)
router.use('/auth', authRoute)
router.use('/plans', planRouter)
router.use('/admin', adminRouter)
router.use('/wallet', walletRouter)
router.use('/team', teamRouter)
router.use('/kyc', kycRouter)

router.use('/category', categoryRouter);
router.use('/product', productRouter);
router.use('/store', cartRouter);
router.use('/shop', shopRouter);

module.exports = router;