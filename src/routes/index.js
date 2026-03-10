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
const bannerRouter = require('./banner.route.js');
const adminSetupRouter = require('./shop/admin_setup.routes.js')
const shopRouter = require('./shop/shop.routes.js')
const mainCategoryRouter = require('./shop/mainCategory.routes.js')
const shopProductRouter = require('./shop/shopProduct.routes.js')
const shopCartRouter = require('./shop/cart.route.js')
const orderRouter = require('./shop/order.route.js')
const notificationRouter = require('./notification.route.js')
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
router.use('/admin-setup', adminSetupRouter);
router.use('/main-category', mainCategoryRouter);
router.use('/shopProduct', shopProductRouter);
router.use('/shopCart', shopCartRouter);
router.use('/orderOffline', orderRouter);

router.use('/banners', bannerRouter);
router.use('/notifications', notificationRouter);

module.exports = router;