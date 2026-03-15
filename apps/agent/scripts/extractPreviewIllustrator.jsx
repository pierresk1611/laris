function main() {
    if (app.documents.length === 0) return JSON.stringify({ status: "ERROR", message: "No document open" });
    var doc = app.activeDocument;

    var tempFile = new File(Folder.temp + "/ai_preview.jpg");
    var exportOptions = new ExportOptionsJPEG();
    exportOptions.antiAliasing = true;
    exportOptions.qualitySetting = 80;
    exportOptions.artBoardClipping = true;

    try {
        doc.exportFile(tempFile, ExportType.JPEG, exportOptions);
        return JSON.stringify({ status: "SUCCESS", path: tempFile.fsName });
    } catch (e) {
        return JSON.stringify({ status: "ERROR", message: e.toString() });
    }
}
var result = main();
var file = new File(Folder.temp + "/ai_preview_result.json");
file.open("w");
file.write(result);
file.close();
