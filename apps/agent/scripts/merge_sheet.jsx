// merge_sheet.jsx - AutoDesign Photoshop Automator
// Combines pre-rendered PDFs into a single SRA3 sheet

#target photoshop
app.displayDialogs = DialogModes.NO;

if (typeof JSON !== 'object') {
    // Basic JSON parser not needed for standard modern PS if wrapper provides it, 
    // but just in case, we assume JSON is available from the wrapper.
}

function px(mm) {
    // 300 DPI: 1 mm = 11.811 pixels
    return mm * 11.811;
}

function main(payloadPath) {
    var result = { status: 'SUCCESS', files: [] };

    try {
        var payloadFile = new File(payloadPath);
        if (!payloadFile.exists) throw new Error("Payload file not found: " + payloadPath);

        payloadFile.open('r');
        var jsonString = payloadFile.read();
        payloadFile.close();

        var job = JSON.parse(jsonString);
        var layout = job.layout; // { sheetWidth: 320, sheetHeight: 450, items: [{x,y,width,height}] }
        var outputDir = new Folder(job.outputDir);
        if (!outputDir.exists) outputDir.create();

        // 1. Create new Document for Sheet
        var sheetWidthPx = px(layout.sheetWidth);
        var sheetHeightPx = px(layout.sheetHeight);
        var doc = app.documents.add(sheetWidthPx, sheetHeightPx, 300, "PrintSheet_" + job.jobId, NewDocumentMode.CMYK, DocumentFill.WHITE);

        // 2. Place items
        var itemIdx = 0;
        for (var i = 0; i < job.orders.length; i++) {
            var order = job.orders[i];
            // The Agent passed the pre-rendered PDF path in `order.pdfPath`
            if (!order.pdfPath) continue;

            var pdfFile = new File(order.pdfPath);
            if (!pdfFile.exists) continue;

            // Determine how many copies of this order we need?
            // Wait, the API/Javascript logic created layout.items which is just a list of boxes. 
            // The number of boxes in layout.items exactly matches the number of items we place!
            // Wait, there are `totalItems` boxes, but job.orders is an array of orders. 
            // In the JS, `totalItems = orders.reduce((sum, o) => sum + o.quantity, 0)`
            // So we loop over orders, and place `order.quantity` copies!
            var copies = order.quantity || 1;
            for (var c = 0; c < copies; c++) {
                if (itemIdx >= layout.items.length) break; // Sheet is full

                var box = layout.items[itemIdx];
                placePdf(doc, pdfFile, box);
                itemIdx++;
            }
        }

        // 3. Export Sheet as PDF
        var outputFile = new File(outputDir + "/PrintSheet_" + job.jobId + "_" + job.sheetFormat + ".pdf");
        exportPDF(doc, outputFile);
        result.files.push("PrintSheet_" + job.jobId + "_" + job.sheetFormat + ".pdf");

        doc.close(SaveOptions.DONOTSAVECHANGES);

        // Write Result
        var resultFile = new File(payloadPath.replace("job_", "result_"));
        resultFile.open('w');
        resultFile.write(JSON.stringify(result));
        resultFile.close();

    } catch (e) {
        var errorFile = new File(payloadPath.replace("job_", "error_"));
        errorFile.open('w');
        errorFile.write(JSON.stringify({ status: 'ERROR', message: e.toString() }));
        errorFile.close();
    }
}

function placePdf(doc, currentFile, box) {
    // Place the PDF as a Smart Object
    var idPlc = charIDToTypeID("Plc ");
    var descPlc = new ActionDescriptor();
    var idVrsn = charIDToTypeID("Vrsn");
    descPlc.putInteger(idVrsn, 5); // Crop to Trim Box
    var idnull = charIDToTypeID("null");
    descPlc.putPath(idnull, currentFile);
    var idFTcs = charIDToTypeID("FTcs");
    var idQCSt = charIDToTypeID("QCSt");
    var idQcsa = charIDToTypeID("Qcsa");
    descPlc.putEnumerated(idFTcs, idQCSt, idQcsa);

    // Calculate placement offset
    // Photoshop places Smart Objects in the exact center of the document by default
    var docCenterX = doc.width.as('px') / 2;
    var docCenterY = doc.height.as('px') / 2;

    var objectCenterX = px(box.x + (box.width / 2));
    var objectCenterY = px(box.y + (box.height / 2));

    var offsetX = objectCenterX - docCenterX;
    var offsetY = objectCenterY - docCenterY;

    var idOfst = charIDToTypeID("Ofst");
    var descOfst = new ActionDescriptor();
    var idHrzn = charIDToTypeID("Hrzn");
    var idPxl = charIDToTypeID("#Pxl");
    descOfst.putUnitDouble(idHrzn, idPxl, offsetX);
    var idVrtc = charIDToTypeID("Vrtc");
    descOfst.putUnitDouble(idVrtc, idPxl, offsetY);
    var idOfst2 = charIDToTypeID("Ofst");
    descPlc.putObject(idOfst2, idOfst, descOfst);

    executeAction(idPlc, descPlc, DialogModes.NO);
}

function exportPDF(doc, file) {
    var opts = new PDFSaveOptions();
    opts.presetFile = "[PDF/X-1a:2001]";
    opts.encoding = PDFEncoding.JPEG;
    opts.jpegQuality = 12;
    opts.layers = false;
    opts.embedColorProfile = true;
    opts.colorConversion = true;
    opts.destinationProfile = "Coated FOGRA39 (ISO 12647-2:2004)";
    doc.saveAs(file, opts, true, Extension.LOWERCASE);
}
