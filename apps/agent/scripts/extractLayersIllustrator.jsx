function getLayers() {
    var layers = [];
    if (app.documents.length === 0) return "[]";
    var doc = app.activeDocument;

    // 1. Get all Text Frames
    for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];
        // In Illustrator, text frames often don't have custom names unless set by user
        // We use tf.contents as a fallback identifier
        layers.push({
            name: tf.name || tf.contents.substring(0, 50),
            type: 'TEXT'
        });
    }

    // 2. Add other specifically named layers if they exist (groups, etc)
    // Sometimes users name layers like "PHOTO_TAG" etc.
    for (var j = 0; j < doc.layers.length; j++) {
        var layer = doc.layers[j];
        if (layer.name && layer.name.match(/^[A-Z_]+$/)) { // High confidence these are mapping keys
            // Check if already added via text frames (unlikely to have exact name match)
            layers.push({
                name: layer.name,
                type: 'GROUP'
            });
        }
    }

    return JSON.stringify(layers);
}

var result = getLayers();
var file = new File(Folder.temp + "/ai_layers.json");
file.open("w");
file.write(result);
file.close();
