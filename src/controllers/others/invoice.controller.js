const { generateInvoicePDF } = require("../../services/pdf.service");

const PlanPurchase = require("../../models/planPurchase.model");

// const testDummyInvoice = async (req, res) => {
//     try {
//         const dummyInvoiceData = {
//             company: {
//                 name: "TRUHAAT SALES AND NETWORKING PRIVATE LIMITED",
//                 address: "29/E/290, GROUND FLOOR, GHARONDA, PRATAP NAGAR, SECTOR-11, SANGANER, JAIPUR RAJASTHAN-302033",
//                 gstin: "08AAMCT0160D1ZK",
//                 phone: "01414606217, +91-9314010888",
//                 email: "INFO.TRUHAAT@GMAIL.COM"
//             },
//             customer: {
//                 name: "VISHALSINGH CHAUHAN",
//                 addressStr: "29Y16 PRATAP NAGAR SANGANER JAIPUR 302033",
//                 placeOfSupply: "Rajasthan",
//                 stateCode: "08",
//                 phone: "8239886888"
//             },
//             invoiceDetails: {
//                 invoiceNo: "TRUHONL1-TEST",
//                 orderNo: "ORD1788009067357",
//                 date: "30-Apr-26",
//                 paymentTerms: "ONLINE",
//                 paymentRef: "PAY_123456789XYZ", // NEW PAYMENT REFERENCE
//                 courierName: "DELHIVERY",
//                 trackingDetails: "AWB123456789"
//             },
//             items: [
//                 // Notice the "unit" property added to each item (PCS, SET, NOS)
//                 { description: "JAIPURI DOUBLE BEDSHEET", hsn: "9403", qty: 1, unit: "PCS", rate: 1000.00, discPercent: 4.76, discAmount: 47.62, taxableValue: 952.38, cgst: { rate: 2.5, amount: 23.81 }, sgst: { rate: 2.5, amount: 23.81 }, igst: { rate: 0, amount: 0 }, totalAmount: 1000.00 },

//                 { description: "NACLACE", hsn: "7113", qty: 1, unit: "SET", rate: 1200.00, discPercent: 2.91, discAmount: 34.95, taxableValue: 1165.05, cgst: { rate: 1.5, amount: 17.47 }, sgst: { rate: 1.5, amount: 17.48 }, igst: { rate: 0, amount: 0 }, totalAmount: 1200.00 },

//                 { description: "JAIPURI BANDEZ 3 PCS SET", hsn: "6204", qty: 1, unit: "SET", rate: 1300.00, discPercent: 4.76, discAmount: 61.91, taxableValue: 1238.09, cgst: { rate: 2.5, amount: 30.95 }, sgst: { rate: 2.5, amount: 30.95 }, igst: { rate: 0, amount: 0 }, totalAmount: 1299.99 },

//                 { description: "DOUBLE BED BLANCKET", hsn: "6301", qty: 1, unit: "PCS", rate: 2500.00, discPercent: 4.79, discAmount: 119.91, taxableValue: 2380.09, cgst: { rate: 2.5, amount: 59.50 }, sgst: { rate: 2.5, amount: 59.50 }, igst: { rate: 0, amount: 0 }, totalAmount: 2499.09 },

//                 { description: "SILVER MEMBERSHIP@499", hsn: "9995", qty: 1, unit: "NOS", rate: 499.99, discPercent: 15.25, discAmount: 76.27, taxableValue: 423.72, cgst: { rate: 9, amount: 38.14 }, sgst: { rate: 9, amount: 38.14 }, igst: { rate: 0, amount: 0 }, totalAmount: 499.99 }
//             ],
//             totals: {
//                 taxableValue: 6159.33,
//                 cgst: 169.87,
//                 sgst: 169.88,
//                 igst: 0,
//                 grandTotal: 6499.07
//             }
//         };

//         generateInvoicePDF(dummyInvoiceData, res);

//     } catch (error) {
//         console.error("Test Invoice generation error:", error);
//         res.status(500).send("Failed to generate PDF");
//     }
// };

// module.exports = { testDummyInvoice };


// Helper to reverse-calculate GST from inclusive prices
const calculateInvoiceLine = (description, hsn, qty, unit, totalInclusive, taxPercent, isRajasthan) => {
    const taxableValue = Number((totalInclusive / (1 + (taxPercent / 100))).toFixed(2));
    const taxAmount = Number((totalInclusive - taxableValue).toFixed(2));

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isRajasthan) {
        cgst = Number((taxAmount / 2).toFixed(2));
        sgst = Number((taxAmount - cgst).toFixed(2));
    } else {
        igst = taxAmount;
    }

    return {
        description, hsn, qty, unit,
        rate: Number((taxableValue / qty).toFixed(2)),
        discPercent: 0, discAmount: 0,
        taxableValue,
        cgst: { rate: isRajasthan ? taxPercent / 2 : 0, amount: cgst },
        sgst: { rate: isRajasthan ? taxPercent / 2 : 0, amount: sgst },
        igst: { rate: !isRajasthan ? taxPercent : 0, amount: igst },
        totalAmount: totalInclusive
    };
};

const getPlanInvoice = async (req, res) => {
    try {
        const { purchaseId } = req.params;
        const purchase = await PlanPurchase.findById(purchaseId).populate('user').populate('plan');
        if (!purchase) return res.status(404).send('Invoice not found');

        // 1. Determine Tax Type (IGST vs CGST/SGST)
        const COMPANY_STATE_CODE = '08'; // Rajasthan

        const rawStateCode = String(
            purchase.shippingAddress?.stateCode || ''
        ).trim();

        const customerStateCode = /^\d{2}$/.test(rawStateCode)
            ? rawStateCode
            : null;

        const isRajasthan = customerStateCode === COMPANY_STATE_CODE;

        let invoiceLines = [];
        let physicalItemsTotal = 0;

        // 2. Map Physical Items from the frozen snapshot
        const items = purchase.bundleSnapshot?.invoiceItems || [];
        items.forEach(item => {
            const line = calculateInvoiceLine(
                item.itemName,
                item.hsnCode || '0000',
                item.qty || 1,
                'PCS', // Default unit
                item.rate || 0, // This is inclusive total
                item.taxPercent || 5, // Default tax
                isRajasthan
            );
            invoiceLines.push(line);
            physicalItemsTotal += line.totalAmount;
        });

        // 3. Dynamic Digital Membership Injection (The Gap)
        const amountPaid = purchase.amount;
        const difference = Number((amountPaid - physicalItemsTotal).toFixed(2));

        if (difference > 0) {
            const digitalLine = calculateInvoiceLine(
                `${purchase.bundleSnapshot?.comboName || 'Membership'} (Digital)`,
                '9995', 1, 'NOS', difference, 18, isRajasthan
            );
            invoiceLines.push(digitalLine);
        }

        // 4. Calculate Grand Totals
        const totals = invoiceLines.reduce((acc, line) => {
            acc.taxableValue += line.taxableValue;
            acc.cgst += line.cgst.amount;
            acc.sgst += line.sgst.amount;
            acc.igst += line.igst.amount;
            return acc;
        }, { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: amountPaid });

        // 5. Structure data for our PDF Service
        const invoiceData = {
            company: {
                name: "TRUHAAT SALES AND NETWORKING PRIVATE LIMITED",
                address: "29/E/290, GROUND FLOOR, GHARONDA, PRATAP NAGAR, SECTOR-11, SANGANER, JAIPUR RAJASTHAN-302033",
                gstin: "08AAMCT0160D1ZK", phone: "01414606217, +91-9314010888", email: "INFO.TRUHAAT@GMAIL.COM"
            },
            customer: {
                // Check address first, if empty, fall back to the populated User document, if still empty use 'Unknown User'
                name: (purchase.shippingAddress?.firstName || purchase.shippingAddress?.lastName)
                    ? `${purchase.shippingAddress?.firstName || ''} ${purchase.shippingAddress?.lastName || ''}`.trim()
                    : `${purchase.user?.firstName || ''} ${purchase.user?.lastName || ''}`.trim() || 'Unknown User',

                addressStr: `${purchase.shippingAddress?.addressLine1 || ''}, ${purchase.shippingAddress?.city || ''}, ${purchase.shippingAddress?.pincode || ''}`,
                placeOfSupply: purchase.shippingAddress?.state || 'N/A',
                stateCode: customerStateCode || 'N/A',

                // Same logic for phone: prioritize address, then user profile
                phone: purchase.shippingAddress?.phone || purchase.user?.phone || 'N/A',
                email: purchase.user?.email || purchase.shippingAddress?.email || 'N/A'
            },
            invoiceDetails: {
                invoiceNo: purchase.invoiceNumber,
                orderNo: purchase.razorpayOrderId || 'N/A',
                date: new Date(purchase.paidAt || purchase.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-'), // DD-MM-YYYY
                paymentTerms: "ONLINE", paymentRef: purchase.razorpayPaymentId || 'N/A',
                // courierName: "DELHIVERY",
                deliveryMethod:
                    purchase.deliveryMethod === 'BY_HAND'
                        ? 'BY HAND'
                        : 'COURIER',

                courierName:
                    purchase.deliveryMethod === 'BY_HAND'
                        ? 'N/A'
                        : purchase.trackingDetails?.courierPartner || 'Pending',

                trackingDetails:
                    purchase.deliveryMethod === 'BY_HAND'
                        ? 'N/A'
                        : purchase.trackingDetails?.trackingId || 'Pending'
            },
            items: invoiceLines,
            totals: totals
        };

        // Stream PDF direct to client!
        console.log(invoiceData);
        generateInvoicePDF(invoiceData, res);

    } catch (error) {
        console.error('Real Invoice Error:', error);
        res.status(500).send("Failed to generate PDF");
    }
};

module.exports = { getPlanInvoice }; // Make sure to export it!