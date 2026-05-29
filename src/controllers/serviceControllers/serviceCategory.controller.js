const ServiceCategory = require('../../models/ServiceModel/serviceCategory.model');
const ServicePriceBook = require('../../models/ServiceModel/servicePriceBook.model');
const ServiceSubcategory = require('../../models/ServiceModel/serviceSubcategory.model');
const ServiceSubService = require('../../models/ServiceModel/serviceSubService.model');

const cloudinary = require('cloudinary').v2;


// Helper function to handle Cloudinary stream uploads directly from memory buffer
const streamUpload = (fileBuffer, folderName) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: folderName },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        stream.end(fileBuffer);
    });
};

// ==========================================
// MAIN CATEGORY CONTROLLERS
// ==========================================
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Category name is required' });
        }

        const existing = await ServiceCategory.findOne({ name: name.trim() });
        if (existing) {
            return res.status(400).json({ success: false, error: 'Category already exists' });
        }

        const category = await ServiceCategory.create({ name: name.trim() });
        return res.status(201).json({ success: true, data: category });
    } catch (error) {
        console.error('createCategory Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getAllCategories = async (req, res) => {
    try {
        const categories = await ServiceCategory.find({ isActive: true });
        return res.json({ success: true, data: categories });
    } catch (error) {
        console.error('getAllCategories Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ==========================================
// SUBCATEGORY CONTROLLERS WITH CLOUDINARY
// ==========================================
const createSubcategory = async (req, res) => {
    try {
        const { parentCategoryId, name, basePrice } = req.body;

        if (!parentCategoryId || !name) {
            return res.status(400).json({ success: false, error: 'parentCategoryId and name are required' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Subcategory image file is required' });
        }

        // 1. Verify parent category exists
        const parentExists = await ServiceCategory.findById(parentCategoryId);
        if (!parentExists) {
            return res.status(404).json({ success: false, error: 'Parent category not found' });
        }

        // 2. Check for exact duplicate within same parent scope
        const existing = await ServiceSubcategory.findOne({
            parentCategory: parentCategoryId,
            name: name.trim()
        });
        if (existing) {
            return res.status(400).json({ success: false, error: 'Subcategory name already exists under this category' });
        }

        // 3. Upload to Cloudinary under 'truhaat_services' directory
        let cloudinaryResult;
        try {
            cloudinaryResult = await streamUpload(req.file.buffer, 'truhaat_services');
        } catch (uploadError) {
            console.error('Cloudinary Upload Fail:', uploadError);
            return res.status(500).json({ success: false, error: 'Failed to upload image asset to cloud' });
        }

        // 4. Save to Database
        const subcategory = await ServiceSubcategory.create({
            parentCategory: parentCategoryId,
            name: name.trim(),
            basePrice: basePrice || 0,
            image: cloudinaryResult.secure_url,
            imagePublicId: cloudinaryResult.public_id
        });

        return res.status(201).json({ success: true, data: subcategory });
    } catch (error) {
        console.error('createSubcategory Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getSubcategoriesByParent = async (req, res) => {
    try {
        const { parentCategoryId } = req.params;

        if (!parentCategoryId) {
            return res.status(400).json({ success: false, error: 'parentCategoryId is required' });
        }

        const subcategories = await ServiceSubcategory.find({
            parentCategory: parentCategoryId,
            isActive: true
        });

        return res.json({ success: true, data: subcategories });
    } catch (error) {
        console.error('getSubcategoriesByParent Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// =========================================================
// ADMIN CONTROLLERS: SUB-SERVICE ITEMS
// =========================================================

const createSubService = async (req, res) => {
    try {
        const { subcategoryId, name, description } = req.body;

        if (!subcategoryId || !name) {
            return res.status(400).json({ success: false, error: 'subcategoryId and name are required' });
        }

        // 1. Verify parent subcategory exists
        const subcategoryExists = await ServiceSubcategory.findById(subcategoryId);
        if (!subcategoryExists) {
            return res.status(404).json({ success: false, error: 'Parent subcategory not found' });
        }

        // 2. Prevent exact duplicate within the same subcategory parent scope
        const existing = await ServiceSubService.findOne({
            subcategory: subcategoryId,
            name: name.trim()
        });
        if (existing) {
            return res.status(400).json({ success: false, error: 'This sub-service item already exists under this subcategory' });
        }

        const item = await ServiceSubService.create({
            subcategory: subcategoryId,
            name: name.trim(),
            description: description ? description.trim() : ''
        });

        return res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('createSubService Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// =========================================================
// ADMIN CONTROLLERS: MANUAL LOCATION PRICE BOOK
// =========================================================

const addLocationPrice = async (req, res) => {
    try {
        const { subServiceId, country, state, city, pincode, price } = req.body;

        if (!subServiceId || !state || !city || !pincode || price === undefined) {
            return res.status(400).json({
                success: false,
                error: 'subServiceId, state, city, pincode, and price are required'
            });
        }

        const cleanPincode = pincode.trim();
        // Validation boundary check to ensure standard 6-digit formatting
        if (!/^\d{6}$/.test(cleanPincode)) {
            return res.status(400).json({ success: false, error: 'Invalid pincode format. Must be an exact 6-digit numeric string.' });
        }

        // 1. Ensure target item reference exists
        const subServiceExists = await ServiceSubService.findById(subServiceId);
        if (!subServiceExists) {
            return res.status(404).json({ success: false, error: 'Target sub-service item not found' });
        }

        // 2. Standardize inputs to case-insensitive variants
        const cleanCountry = country ? country.trim().toLowerCase() : 'india';
        const cleanState = state.trim().toLowerCase();
        const cleanCity = city.trim().toLowerCase();

        // 3. Prevent duplicate price overlapping rules
        const existingPrice = await ServicePriceBook.findOne({
            subService: subServiceId,
            country: cleanCountry,
            state: cleanState,
            city: cleanCity,
            pincode: cleanPincode
        });

        if (existingPrice) {
            return res.status(400).json({ success: false, error: 'A price entry already exists for this item inside this location layout' });
        }

        // 3. Persist record cleanly
        const priceRecord = await ServicePriceBook.create({
            subService: subServiceId,
            country: cleanCountry,
            state: cleanState,
            city: cleanCity,
            pincode: cleanPincode,
            price: Number(price)
        });

        return res.status(201).json({ success: true, data: priceRecord });
    } catch (error) {
        console.error('addLocationPrice Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// =========================================================
// USER APP CONTROLLER: LOCATIONAL PRICE RESOLUTION ENGINE
// =========================================================

const getAvailableServicesByLocation = async (req, res) => {
    try {
        const { subcategoryId, pincode } = req.body;

        if (!subcategoryId || !pincode) {
            return res.status(400).json({ success: false, error: 'subcategoryId and pincode string are required' });
        }

        const cleanPincode = pincode.trim();

        // 1. Grab all active catalog items tied to this subcategory grouping
        const items = await ServiceSubService.find({ subcategory: subcategoryId, isActive: true });
        if (items.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const resolvedCatalog = [];

        // 2. Loop through and map matches based strictly on the passed pincode token
        for (const item of items) {
            const priceMatch = await ServicePriceBook.findOne({
                subService: item._id,
                pincode: cleanPincode,
                isActive: true
            });

            if (priceMatch) {
                resolvedCatalog.push({
                    subServiceId: item._id,
                    name: item.name,
                    description: item.description,
                    price: priceMatch.price
                });
            }
        }

        // 3. Fallback boundary evaluation
        if (resolvedCatalog.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'SERVICE_UNAVAILABLE',
                message: `Services are currently unavailable in pincode area: ${cleanPincode}`
            });
        }

        return res.json({ success: true, data: resolvedCatalog });
    } catch (error) {
        console.error('getAvailableServicesByLocation Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getSubServicesBySubcategory = async (req, res) => {
    try {
        const { subcategoryId } = req.params;
        const subservices = await ServiceSubService.find({ subcategory: subcategoryId });
        return res.json({ success: true, data: subservices });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getPriceBookBySubService = async (req, res) => {
    try {
        const { subServiceId } = req.params;
        const prices = await ServicePriceBook.find({ subService: subServiceId });
        return res.json({ success: true, data: prices });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getUniversalPriceBookGrid = async (req, res) => {
    try {
        const { subServiceId, country, state, city, pincode } = req.body;

        // 1. Initialize an empty dynamic query condition criteria map
        const queryCondition = { isActive: true };

        // 2. Conditionally mount filter locks based explicitly on body parameter input presence
        if (subServiceId) {
            queryCondition.subService = subServiceId;
        }

        if (country) {
            queryCondition.country = country.trim().toLowerCase();
        }

        if (state) {
            queryCondition.state = state.trim().toLowerCase();
        }

        if (city) {
            queryCondition.city = city.trim().toLowerCase();
        }

        if (pincode) {
            const cleanPincode = pincode.trim();
            if (cleanPincode.length > 0) {
                queryCondition.pincode = cleanPincode;
            }
        }

        console.log("🚀 Executing Universal Grid Search with Conditions:", queryCondition);

        // 3. Fetch matching data rows from MongoDB, populating the base item schema properties safely
        const priceGridRecords = await ServicePriceBook.find(queryCondition)
            .populate({
                path: 'subService',
                select: 'name description subcategory'
            })
            .sort({ country: 1, state: 1, city: 1, pincode: 1 });

        // 4. Format return payload structure to map cleanly directly into your dashboard data-tables
        const formattedGrid = priceGridRecords.map(record => ({
            priceBookId: record._id,
            subServiceId: record.subService?._id || null,
            subServiceName: record.subService?.name || 'Unlinked Base Item',
            subServiceDescription: record.subService?.description || '',
            country: record.country,
            state: record.state,
            city: record.city,
            pincode: record.pincode,
            price: record.price,
            isActive: record.isActive,
            updatedAt: record.updatedAt
        }));

        return res.json({
            success: true,
            totalRecordsFound: formattedGrid.length,
            data: formattedGrid
        });

    } catch (error) {
        console.error('getUniversalPriceBookGrid Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error compiling universal matrix grid paths.' });
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    createSubcategory,
    getSubcategoriesByParent,
    getAvailableServicesByLocation,
    createSubService,
    addLocationPrice,
    getSubServicesBySubcategory,
    getPriceBookBySubService,
    getUniversalPriceBookGrid
};