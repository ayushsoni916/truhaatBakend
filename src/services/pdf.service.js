const PDFDocument = require('pdfkit');
const converter = require('number-to-words');

const generateInvoicePDF = (data, res) => {
    // Initialize PDF Document with standard A4 margins
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${data.invoiceDetails.invoiceNo}.pdf`);
    doc.pipe(res);

    // --- 1. HEADER (Company Details) ---
    doc.fontSize(16).font('Helvetica-Bold').text(data.company.name, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(data.company.address, { align: 'center' });
    doc.text(`GSTIN/UIN: ${data.company.gstin} | Contact: ${data.company.phone}`, { align: 'center' });

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Tax Invoice', { align: 'center', underline: true });
    doc.moveDown();

    // --- 2. BILLING & INVOICE META DETAILS ---
    const topY = doc.y;

    if (data.shop) {
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .text(
                'Store Details:',
                30,
                topY
            );

        doc.fontSize(9)
            .text(data.shop.name || 'N/A');

        doc.font('Helvetica')
            .text(
                `Address: ${data.shop.addressStr || 'N/A'
                }`,
                { width: 250 }
            )
            .text(
                `State: ${data.shop.state || 'N/A'
                } (Code: ${data.shop.stateCode || 'N/A'
                })`
            )
            .text(
                `GSTIN/UIN: ${data.shop.gstin || 'N/A'
                }`
            )
            .text(
                `Contact Person: ${data.shop.contactPerson || 'N/A'
                }`
            )
            .text(
                `Contact: ${data.shop.phone || 'N/A'
                }`
            );

        doc.moveDown();
    }

    const customerTopY = data.shop ? doc.y : topY;

    // Left side: Customer (Properly Formatted)
    doc.fontSize(10).font('Helvetica-Bold').text(
        'Billed To:',
        30,
        customerTopY
    );
    doc.fontSize(9).text(data.customer.name);
    doc.font('Helvetica')
        .text(`Address: ${data.customer.addressStr}`, { width: 250 })
        .text(`State: ${data.customer.placeOfSupply} (Code: ${data.customer.stateCode})`)
        .text(`Contact: ${data.customer.phone}`)
        .text(`Email: ${data.customer.email}`);

    const leftBottomY = doc.y;

    // Right side: Invoice Meta 
    const paymentStr = data.invoiceDetails.paymentRef
        ? `${data.invoiceDetails.paymentTerms} - ${data.invoiceDetails.paymentRef}`
        : data.invoiceDetails.paymentTerms;

    doc.font('Helvetica-Bold').fontSize(9)
        // We explicitly set X and Y here so it starts at the same height as "Billed To:"
        .text(`Invoice No: ${data.invoiceDetails.invoiceNo}`, 320, topY)
        .text(`Order No: ${data.invoiceDetails.orderNo || 'N/A'}`)
        .text(`Date: ${data.invoiceDetails.date}`)
        .text(`Payment: ${paymentStr}`)
        .text(
            `Delivery Method: ${data.invoiceDetails.deliveryMethod || 'COURIER'
            }`
        )
        .text(
            `Courier: ${data.invoiceDetails.courierName || 'N/A'
            }`
        )
        .text(
            `Tracking: ${data.invoiceDetails.trackingDetails || 'N/A'
            }`
        );

    const rightBottomY = doc.y;

    // --- 3. MAIN TABLE HEADER ---
    let tableTop;

    if (data.shop) {
        // Offline invoice: begin below both store/customer and invoice details
        doc.y = Math.max(leftBottomY, rightBottomY) + 15;
        tableTop = doc.y;
    } else {
        // Preserve the existing MLM and online invoice layout
        doc.moveDown(2);
        tableTop = doc.y;
    }

    doc.rect(30, tableTop, 535, 20).fill('#f4f4f4');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7);

    const cols = {
        sno: 32, desc: 50, hsn: 145, qty: 180, unit: 205, rate: 230,
        discP: 265, discA: 300, taxable: 340, cgst: 390, sgst: 440, total: 490
    };

    const isIGSTInvoice =
        data.taxType === 'IGST' ||
        data.items.some(
            item =>
                Number(item.igst?.rate || 0) > 0 ||
                Number(item.igst?.amount || 0) > 0
        );

    doc.text('Sl', cols.sno, tableTop + 5);
    doc.text('Description', cols.desc, tableTop + 5);
    doc.text('HSN', cols.hsn, tableTop + 5);
    doc.text('Qty', cols.qty, tableTop + 5);
    doc.text('Unit', cols.unit, tableTop + 5);
    doc.text('Rate', cols.rate, tableTop + 5);
    doc.text('Disc %', cols.discP, tableTop + 5);
    doc.text('Disc Amt', cols.discA, tableTop + 5);
    doc.text('Taxable', cols.taxable, tableTop + 5);
    doc.text(
        isIGSTInvoice ? 'IGST(%)' : 'CGST(%)',
        cols.cgst,
        tableTop + 5
    );

    doc.text(
        isIGSTInvoice ? '' : 'SGST(%)',
        cols.sgst,
        tableTop + 5
    );
    doc.text('Total', cols.total, tableTop + 5);

    // --- 4. MAIN TABLE ROWS ---
    let rowY = tableTop + 25;
    doc.font('Helvetica').fontSize(7);

    data.items.forEach((item, i) => {
        doc.moveTo(30, rowY - 5).lineTo(565, rowY - 5).stroke('#e0e0e0');

        doc.text(i + 1, cols.sno, rowY);
        doc.text(item.description, cols.desc, rowY, { width: 90 });
        doc.text(item.hsn, cols.hsn, rowY);
        doc.text(item.qty, cols.qty, rowY);
        doc.text(item.unit || 'PCS', cols.unit, rowY);
        doc.text(item.rate.toFixed(2), cols.rate, rowY);
        doc.text((item.discPercent || 0).toFixed(2), cols.discP, rowY);
        doc.text((item.discAmount || 0).toFixed(2), cols.discA, rowY);
        doc.text(item.taxableValue.toFixed(2), cols.taxable, rowY);

        if (isIGSTInvoice) {
            doc.text(
                `${item.igst.rate}%\n${item.igst.amount.toFixed(2)}`,
                cols.cgst,
                rowY
            );
        } else {
            doc.text(
                `${item.cgst.rate}%\n${item.cgst.amount.toFixed(2)}`,
                cols.cgst,
                rowY
            );

            doc.text(
                `${item.sgst.rate}%\n${item.sgst.amount.toFixed(2)}`,
                cols.sgst,
                rowY
            );
        }

        doc.text(item.totalAmount.toFixed(2), cols.total, rowY);

        rowY += 25;
    });

    // --- 5. FOOTER & TOTALS ---
    doc.moveTo(30, rowY)
        .lineTo(565, rowY)
        .stroke('#000000');

    rowY += 7;

    doc.font('Helvetica-Bold').fontSize(8);

    const shippingFee = Number(
        data.totals.shippingFee || 0
    );

    const handlingFee = Number(
        data.totals.handlingFee || 0
    );

    if (shippingFee > 0) {
        doc.text('Shipping:', cols.rate, rowY);

        doc.text(
            `Rs. ${shippingFee.toFixed(2)}`,
            cols.total,
            rowY
        );

        rowY += 14;
    }

    if (handlingFee > 0) {
        doc.text('Handling:', cols.rate, rowY);

        doc.text(
            `Rs. ${handlingFee.toFixed(2)}`,
            cols.total,
            rowY
        );

        rowY += 14;
    }

    // Separator before final totals
    if (shippingFee > 0 || handlingFee > 0) {
        doc.moveTo(225, rowY)
            .lineTo(565, rowY)
            .stroke('#e0e0e0');

        rowY += 7;
    }

    doc.text('Grand Total:', cols.rate, rowY);

    doc.text(
        `Rs. ${Number(
            data.totals.taxableValue || 0
        ).toFixed(2)}`,
        cols.taxable,
        rowY
    );

    if (isIGSTInvoice) {
        doc.text(
            `Rs. ${Number(
                data.totals.igst || 0
            ).toFixed(2)}`,
            cols.cgst,
            rowY
        );
    } else {
        doc.text(
            `Rs. ${Number(
                data.totals.cgst || 0
            ).toFixed(2)}`,
            cols.cgst,
            rowY
        );

        doc.text(
            `Rs. ${Number(
                data.totals.sgst || 0
            ).toFixed(2)}`,
            cols.sgst,
            rowY
        );
    }

    doc.text(
        `Rs. ${Number(
            data.totals.grandTotal || 0
        ).toFixed(2)}`,
        cols.total,
        rowY
    );

    rowY += 15;
    // --- 6. HSN SUMMARY TABLE ---
    doc.y = rowY + 20;
    const summaryTop = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').text('HSN Summary', 30, summaryTop);

    doc.rect(30, summaryTop + 15, 450, 15).fill('#f4f4f4');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);

    const sumCols = { hsn: 40, taxable: 130, rate: 230, taxAmount: 320, total: 400 };
    doc.text('HSN No', sumCols.hsn, summaryTop + 19);
    doc.text('Taxable Value', sumCols.taxable, summaryTop + 19);
    doc.text('Tax Rate', sumCols.rate, summaryTop + 19);
    doc.text('Tax Amount', sumCols.taxAmount, summaryTop + 19);
    doc.text('Total', sumCols.total, summaryTop + 19);

    const hsnSummary = {};
    data.items.forEach(item => {
        const totalTaxRate = item.cgst.rate + item.sgst.rate + (item.igst ? item.igst.rate : 0);
        const itemTaxAmt = item.cgst.amount + item.sgst.amount + (item.igst ? item.igst.amount : 0);

        const groupKey = `${item.hsn}_${totalTaxRate}`;

        if (!hsnSummary[groupKey]) {
            hsnSummary[groupKey] = { hsn: item.hsn, taxable: 0, taxAmount: 0, total: 0, rate: totalTaxRate };
        }

        hsnSummary[groupKey].taxable += item.taxableValue;
        hsnSummary[groupKey].taxAmount += itemTaxAmt;
        hsnSummary[groupKey].total += (item.taxableValue + itemTaxAmt);
    });

    let sumRowY = summaryTop + 35;
    doc.font('Helvetica').fontSize(8);

    Object.values(hsnSummary).forEach(row => {
        doc.moveTo(30, sumRowY - 3).lineTo(480, sumRowY - 3).stroke('#e0e0e0');

        doc.text(row.hsn, sumCols.hsn, sumRowY);
        doc.text(row.taxable.toFixed(2), sumCols.taxable, sumRowY);
        doc.text(`${row.rate}%`, sumCols.rate, sumRowY);
        doc.text(row.taxAmount.toFixed(2), sumCols.taxAmount, sumRowY);
        doc.text(row.total.toFixed(2), sumCols.total, sumRowY);

        sumRowY += 15;
    });
    doc.moveTo(30, sumRowY).lineTo(480, sumRowY).stroke('#000000');

    // --- 7. AMOUNT IN WORDS & SIGNATURE ---
    doc.y = sumRowY + 15;
    const grandTotal = Number(
        data.totals.grandTotal || 0
    );

    const totalPaise = Math.round(
        grandTotal * 100
    );

    const rupees = Math.floor(
        totalPaise / 100
    );

    const paise = totalPaise % 100;

    let amountInWords =
        `INR ${converter
            .toWords(rupees)
            .toUpperCase()}`;

    if (paise > 0) {
        amountInWords +=
            ` AND ${converter
                .toWords(paise)
                .toUpperCase()} PAISE`;
    }

    doc.font('Helvetica-Oblique').text(
        `Amount Chargeable (in words): ${amountInWords} ONLY`,
        30,
        doc.y
    );

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).text('Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 30, doc.y, { width: 300 });

    doc.font('Helvetica-Bold').text('for TRUHAAT SALES AND NETWORKING PRIVATE LIMITED', 300, doc.y - 10, { align: 'right' });
    doc.moveDown(3);
    doc.text('Authorised Signatory', 300, doc.y, { align: 'right' });

    doc.end();
};

module.exports = { generateInvoicePDF };