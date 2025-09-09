// routes/supplier.js
const router = require("express").Router();
const Supplier = require("../models/Supplier");
const { requireAdmin } = require("../../auth-services/middlewares/auth");

router.get("/", async (_req, res) => {
    const suppliers = await Supplier.find().lean();
    res.json(suppliers);
});


router.post("/", requireAdmin, async (req, res) => {
    const { name, contact_name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên NCC" });

    const s = await Supplier.create({ name, contact_name, phone, email, address });
    res.status(201).json(s);
});


module.exports = router;
