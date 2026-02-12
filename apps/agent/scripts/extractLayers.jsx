function getLayers() {
    var layers = [];
    var doc = app.activeDocument;

    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        layers.push({
            name: layer.name,
            type: layer.typename === 'ArtLayer' && layer.kind === LayerKind.TEXT ? 'TEXT' : 'OTHER'
        });
    }

    return JSON.stringify(layers);
}

// Result is written to a file for the agent to pick up
var result = getLayers();
var file = new File(Folder.temp + "/ps_layers.json");
file.open("w");
file.write(result);
file.close();
