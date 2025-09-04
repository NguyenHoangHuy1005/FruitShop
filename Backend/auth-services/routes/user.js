const router = require('express').Router();
const userController = require('../controllers/userController');
const middlewareController = require('../controllers/middlewareController');

// Profile của chính mình
router.get('/me', middlewareController.verifyToken, userController.getMe);
router.put('/me', middlewareController.verifyToken, userController.updateMe);
router.post('/me/avatar',middlewareController.verifyToken, userController.uploadAvatar);

//get all user
router.get("/", middlewareController.verifyToken, userController.getAllUsers);
//delete user by id
router.delete("/:id",middlewareController.verifyTokenAndAdminAuth, userController.deleteUser);
//update user by id
router.put("/:id",middlewareController.verifyTokenAndAdminAuth, userController.updateUser);
module.exports = router;
