// admin-services/routes/warehouse.js
const router = require("express").Router();
const Warehouse = require("../models/Warehouse");
const { requireAdmin } = require("../../auth-services/middlewares/auth");

router.get("/", requireAdmin, async (req, res) => {
    const filter = {};
    if (typeof req.query?.active !== "undefined") {
        filter.active = req.query.active !== "false";
    }
    const warehouses = await Warehouse.find(filter).sort({ name: 1 }).lean();
    res.json(warehouses);
});

router.post("/", requireAdmin, async (req, res) => {
    const { name, address, phone, contactName, note } = req.body || {};
    if (!name || !name.trim()) {
        return res.status(400).json({ message: "Thiếu tên kho." });
    }
    if (!address || !address.trim()) {
        return res.status(400).json({ message: "Thiếu địa chỉ kho." });
    }
    const payload = {
        name: name.trim(),
        address: address.trim(),
        phone: phone?.trim() || "",
        contactName: contactName?.trim() || "",
        note: note?.trim() || "",
    };
    const created = await Warehouse.create(payload);
    return res.status(201).json(created);
});

module.exports = router;
