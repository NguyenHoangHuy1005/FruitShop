const router = require('express').Router();
const userController = require('../controllers/userController');
const middlewareController = require('../controllers/middlewareController');

//get all user
router.get("/", middlewareController.verifyToken, userController.getAllUsers);
//delete user by id
router.delete("/:id",middlewareController.verifyTokenAndAdminAuth, userController.deleteUser);
//update user by id
router.put("/:id",middlewareController.verifyTokenAndAdminAuth, userController.updateUser);
module.exports = router;
