const User = require("../models/User");

const userController = {

    getAllUsers: async (req, res) => {
        try {
            const user = await User.find();
            res.status(200).json(user);

        } catch (error) {
            console.error(error);
            res.status(500).json(err);
        }
    },

    deleteUser: async (req, res) => {
        try {
            const user = await User.findByIdAndDelete(req.params.id);
            res.status(200).json(user);
        } catch (error) {
            console.error(error);
            res.status(500).json(err);
        }
    },
    updateUser: async (req, res) => {
        try {
            const { username, email, phone } = req.body;
            const user = await User.findByIdAndUpdate(
                req.params.id,
                { username, email, phone },
                {
                    new: true,
                    runValidators: true, // đảm bảo validate theo schema
                }
            );
            res.status(200).json(user);
        } catch (error) {
            console.error(error);
            res.status(500).json(error);
        }
    },
}
module.exports = userController;