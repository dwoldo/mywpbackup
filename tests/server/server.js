var path = require('path');
var fs = require('fs');
var basePath = path.resolve('./tests/server/samples');
var LOG = require(path.resolve('utils', 'log.js'));

function loadResponseFile(fileName) {
    try {
        var data = fs.readFileSync(path.join(basePath, fileName));
        var json = JSON.parse(data);
        return json;
    } catch (e) {
        throw e;
    }
}

function serveRequest(req, res) {
    var data = '';

    try {
        if ('id' in req.params && !(!isNaN(parseFloat(req.params.id)) && isFinite(req.params.id))) {
            res.status(400).json('ID is not a number');
            return;
        }

        if ('id' in req.params && 'action' in req.params) {
            // loadResponseFile('site_123456_download_get.json')
            data = loadResponseFile('site_' + req.params.id + '_' + req.params.action + '_' + req.method.toLowerCase() + '.json');
        } else if ('id' in req.params) {
            // loadResponseFile('site_123456_get.json')
            data = loadResponseFile('site_' + req.params.id + '_' + req.method.toLowerCase() + '.json');
        } else {
            // loadResponseFile('sites_get.json')
            data = loadResponseFile('sites_' + req.method.toLowerCase() + '.json');
        }

        res.status(200).json(data);
    } catch (e) {
        res.status(404).send(e.toString());
        LOG(e.toString());
    }
}

function makeServer(port) {
    port = (port === undefined) ? 3000 : port;
    var express = require('express');
    var app = express();

    app.get('/', serveRequest);
    app.get('/:id', serveRequest);
    app.all('/:id/:action', serveRequest);

    var server = app.listen(port, function() {
        var port = server.address().port;
        LOG('Example app listening at port %s', port);
    });

    return server;
}

module.exports = makeServer;
