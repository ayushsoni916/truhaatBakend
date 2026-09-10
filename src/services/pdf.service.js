const PDFDocument = require('pdfkit');
const converter = require('number-to-words');

const generateInvoicePDF = (data, res) => {
    // Initialize PDF Document with standard A4 margins
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Pipe the PDF directly to the HTTP Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${data.invoiceDetails.invoiceNo}.pdf`);
    doc.pipe(res);

    // --- 1. HEADER (Company Details) ---
    doc.fontSize(16).font('Helvetica-Bold').text(data.company.name, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(data.company.address, { align: 'center' });
    doc.text(`GSTIN/UIN: ${data.company.gstin} | Contact: ${data.company.phone} | Email: ${data.company.email}`, { align: 'center' });

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Tax Invoice', { align: 'center', underline: true });
    doc.moveDown();

    // --- 2. PARTY & INVOICE META DETAILS ---
    const topY = doc.y;

    // Left side: Customer
    doc.fontSize(10).font('Helvetica-Bold').text(`Party: ${data.customer.name}`, 30, topY);
    doc.font('Helvetica').fontSize(9)
        .text(data.customer.addressStr)
        .text(`State: ${data.customer.placeOfSupply}, Code: ${data.customer.stateCode}`)
        .text(`Contact: ${data.customer.phone}`);

    // Right side: Invoice Meta
    doc.font('Helvetica-Bold').fontSize(9)
        .text(`Invoice No: ${data.invoiceDetails.invoiceNo}`, 350, topY)
        .text(`Date: ${data.invoiceDetails.date}`)
        .text(`Payment Terms: ${data.invoiceDetails.paymentTerms}`)
        .text(`Place of Supply: ${data.customer.placeOfSupply}`);

    // --- 3. TABLE HEADER ---
    doc.moveDown(2);
    const tableTop = doc.y;

    // Draw table background
    doc.rect(30, tableTop, 535, 20).fill('#f4f4f4');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);

    // Define X coordinates for columns
    const columns = {
        sno: 35, desc: 65, hsn: 220, qty: 260, rate: 300,
        taxable: 350, cgst: 400, sgst: 450, total: 510
    };

    doc.text('Sl', columns.sno, tableTop + 5);
    doc.text('Description of Goods', columns.desc, tableTop + 5);
    doc.text('HSN', columns.hsn, tableTop + 5);
    doc.text('Qty', columns.qty, tableTop + 5);
    doc.text('Rate', columns.rate, tableTop + 5);
    doc.text('Taxable', columns.taxable, tableTop + 5);
    doc.text('CGST', columns.cgst, tableTop + 5);
    doc.text('SGST', columns.sgst, tableTop + 5);
    doc.text('Total', columns.total, tableTop + 5);

    // --- 4. TABLE ROWS ---
    let rowY = tableTop + 25;
    doc.font('Helvetica').fontSize(8);

    data.items.forEach((item, i) => {
        // Draw line separator
        doc.moveTo(30, rowY - 5).lineTo(565, rowY - 5).stroke('#e0e0e0');

        doc.text(i + 1, columns.sno, rowY);
        doc.text(item.description, columns.desc, rowY, { width: 150 });
        doc.text(item.hsn, columns.hsn, rowY);
        doc.text(item.qty, columns.qty, rowY);
        doc.text(item.rate.toFixed(2), columns.rate, rowY);
        doc.text(item.taxableValue.toFixed(2), columns.taxable, rowY);
        doc.text(`${item.cgst.rate}% \n${item.cgst.amount}`, columns.cgst, rowY);
        doc.text(`${item.sgst.rate}% \n${item.sgst.amount}`, columns.sgst, rowY);
        doc.text(item.totalAmount.toFixed(2), columns.total, rowY);

        rowY += 25; // Move down for next row
    });

    // --- 5. FOOTER & TOTALS ---
    doc.moveTo(30, rowY).lineTo(565, rowY).stroke('#000000'); // Bold line
    rowY += 5;

    doc.font('Helvetica-Bold');
    doc.text('Total:', columns.rate, rowY);
    doc.text(`₹${data.totals.taxableValue.toFixed(2)}`, columns.taxable, rowY);
    doc.text(`₹${data.totals.cgst.toFixed(2)}`, columns.cgst, rowY);
    doc.text(`₹${data.totals.sgst.toFixed(2)}`, columns.sgst, rowY);
    doc.text(`₹${data.totals.grandTotal.toFixed(2)}`, columns.total, rowY);

    // --- 6. AMOUNT IN WORDS & SIGNATURE ---
    doc.moveDown(3);
    const amountInWords = converter.toWords(data.totals.grandTotal).toUpperCase();
    doc.font('Helvetica-Oblique').text(`Amount Chargeable (in words): INR ${amountInWords} ONLY`, 30, doc.y);

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).text('Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', 30, doc.y, { width: 300 });

    doc.font('Helvetica-Bold').text('for TRUHAAT SALES AND NETWORKING PRIVATE LIMITED', 300, doc.y - 10, { align: 'right' });
    doc.moveDown(3);
    doc.text('Authorised Signatory', 300, doc.y, { align: 'right' });

    // Finalize PDF
    doc.end();
};

module.exports = { generateInvoicePDF };