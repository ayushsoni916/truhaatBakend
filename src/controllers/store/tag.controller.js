const Tag = require("../../models/store/tag.model");

// 1. Add Tag
exports.addTag = async (req, res, next) => {
    try {
        const { name, isActive } = req.body;

        if (!name) return res.status(400).json({ error: "Tag name is required" });

        // Check if exists
        const exists = await Tag.findOne({ name });
        if (exists) {
            return res.status(400).json({ error: 'Tag already exists' });
        }

        // Save to DB (isActive defaults to true in schema if not provided)
        const tag = await Tag.create({
            name,
            isActive: isActive !== undefined ? isActive : true
        });

        res.status(201).json({ success: true, message: "Tag created", data: tag });
    } catch (error) {
        next(error);
    }
};

// 2. Get All Tags
exports.getTags = async (req, res, next) => {
    try {
        // Fetching all tags (including inactive ones) so Admin can manage them
        const tags = await Tag.find().sort('-createdAt');
        res.status(200).json({ success: true, data: tags });
    } catch (error) {
        next(error);
    }
};

// 3. Delete Tag
exports.deleteTag = async (req, res, next) => {
    try {
        const { id } = req.params;

        const tag = await Tag.findByIdAndDelete(id);
        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        res.status(200).json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Add this below your existing add/get functions
exports.updateTag = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;

        const tag = await Tag.findById(id);
        if (!tag) return res.status(404).json({ error: 'Tag not found' });

        if (name) tag.name = name;
        if (isActive !== undefined) tag.isActive = isActive;

        await tag.save();
        res.status(200).json({ success: true, message: 'Tag updated', data: tag });
    } catch (error) {
        next(error);
    }
};