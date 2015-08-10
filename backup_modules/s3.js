var request = require('request'),
    _ = require('lodash'),
    path = require('path'),
    pkgcloud = require('pkgcloud');
var LOG = require(path.resolve('utils', 'log.js'));

var client = function(config) {
    if (!config || _.isUndefined(config.keyId) || _.isUndefined(config.key) || _.isUndefined(config.provider)) {
        throw Error("Missing S3 config");
    }
    this.config = config;
    this.client = pkgcloud.storage.createClient(config);
};

client.prototype = {
    upload: function(file, callback) {
        var date = new Date();

        var folderName = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
        var params = {
            container: this.config.container,
            remote: path.join(folderName, path.basename(file))
        };

        var readStream = request(file)
            .on('error', function(err) {
                throw err;
            });

        var writeStream = this.client.upload(params);
        writeStream.on('error', function(err) {
            throw err;
        }).on('success', callback);
        LOG('Remote upload has started for', file);
        readStream.pipe(writeStream);
    }
};

module.exports = client;
