app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
function getLayers() {
    var layers = [];
    if (app.documents.length === 0) return "[]";
    var doc = app.activeDocument;

    // 1. Get all Text Frames
    for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];
        layers.push({
            name: tf.name || tf.contents.substring(0, 50),
            type: 'TEXT'
        });
    }

    // 2. Add other specifically named layers
    for (var j = 0; j < doc.layers.length; j++) {
        var layer = doc.layers[j];
        if (layer.name && layer.name.match(/^[A-Z_]+$/)) {
            layers.push({
                name: layer.name,
                type: 'GROUP'
            });
        }
    }

    return JSON.stringify(layers);
}

// 1. Export Layers JSON
var result = getLayers();
var file = new File(Folder.temp + "/ai_layers.json");
file.open("w");
file.write(result);
file.close();

// 2. Export JPG Preview
if (app.documents.length > 0) {
    var tempPreview = new File(Folder.temp + "/ai_preview.jpg");
    var exportOptions = new ExportOptionsJPEG();
    exportOptions.antiAliasing = true;
    exportOptions.qualitySetting = 80;
    exportOptions.artBoardClipping = true;
    try {
        app.activeDocument.exportFile(tempPreview, ExportType.JPEG, exportOptions);
    } catch (e) { }
}
