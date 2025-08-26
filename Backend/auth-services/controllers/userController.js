const User = require("../models/User");
const Order = require("../../product-services/models/Order");

const userController = {
    getAllUsers: async (req, res) => {
        try {
        const users = await User.aggregate([
            {
            $lookup: {
                from: "orders",        // collection đơn hàng
                localField: "_id",     // so sánh với User._id
                foreignField: "user",  // field trong Order
                as: "orders"
            }
            },
            {
            $addFields: {
                totalOrders: { $size: "$orders" }
            }
            },
            {
            $project: {
                username: 1,
                email: 1,
                phone: 1,
                createdAt: 1,
                totalOrders: 1
            }
            }
        ]);

        res.status(200).json(users);
        } catch (error) {
        console.error(error);
        res.status(500).json(error);
        }
    },

    deleteUser: async (req, res) => {
        try {
        const user = await User.findByIdAndDelete(req.params.id);
        res.status(200).json(user);
        } catch (error) {
        console.error(error);
        res.status(500).json(error);
        }
    },

    updateUser: async (req, res) => {
        try {
        const { username, email, phone } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { username, email, phone },
            { new: true, runValidators: true }
        );
        res.status(200).json(user);
        } catch (error) {
        console.error(error);
        res.status(500).json(error);
        }
    }
};

module.exports = userController;
