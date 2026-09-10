const { generateInvoicePDF } = require("../../services/pdf.service");

const testDummyInvoice = async (req, res) => {
    try {
        // DUMMY DATA: Modeled perfectly after the Silver Plan (₹6,499)
        const dummyInvoiceData = {
            company: {
                name: "TRUHAAT SALES AND NETWORKING PRIVATE LIMITED",
                address: "29/E/290, GROUND FLOOR, GHARONDA, PRATAP NAGAR, SECTOR-11, SANGANER, JAIPUR RAJASTHAN-302033",
                gstin: "08AAMCT0160D1ZK",
                phone: "01414606217, +91-9314010888",
                email: "INFO.TRUHAAT@GMAIL.COM"
            },
            customer: {
                name: "VISHALSINGH CHAUHAN",
                addressStr: "29Y16 PRATAP NAGAR SANGANER JAIPUR 302033",
                placeOfSupply: "Rajasthan",
                stateCode: "08",
                phone: "8239886888"
            },
            invoiceDetails: {
                invoiceNo: "TRUHONL1-TEST",
                date: "30-Apr-26",
                paymentTerms: "ONLINE"
            },
            items: [
                { description: "JAIPURI DOUBLE BEDSHEET", hsn: "9403", qty: 1, rate: 952.38, taxableValue: 952.38, cgst: { rate: 2.5, amount: 23.81 }, sgst: { rate: 2.5, amount: 23.81 }, totalAmount: 1000.00 },
                { description: "NACLACE", hsn: "7113", qty: 1, rate: 1165.05, taxableValue: 1165.05, cgst: { rate: 1.5, amount: 17.47 }, sgst: { rate: 1.5, amount: 17.48 }, totalAmount: 1200.00 },
                { description: "JAIPURI BANDEZ 3 PCS SET", hsn: "6204", qty: 1, rate: 1238.09, taxableValue: 1238.09, cgst: { rate: 2.5, amount: 30.95 }, sgst: { rate: 2.5, amount: 30.95 }, totalAmount: 1299.99 },
                { description: "DOUBLE BED BLANCKET", hsn: "6301", qty: 1, rate: 2380.09, taxableValue: 2380.09, cgst: { rate: 2.5, amount: 59.50 }, sgst: { rate: 2.5, amount: 59.50 }, totalAmount: 2499.09 },
                // The Injected Digital Membership!
                { description: "SILVER MEMBERSHIP@499", hsn: "9995", qty: 1, rate: 423.72, taxableValue: 423.72, cgst: { rate: 9, amount: 38.14 }, sgst: { rate: 9, amount: 38.14 }, totalAmount: 499.99 }
            ],
            totals: {
                taxableValue: 6159.33,
                cgst: 169.87,
                sgst: 169.88,
                grandTotal: 6499.07
            }
        };

        // Call the service and pass the Express response object!
        generateInvoicePDF(dummyInvoiceData, res);

    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to generate PDF");
    }
};

module.exports = { testDummyInvoice };