// force the test environment to 'test'
var async = require('async');
var assert = require("assert");
var simple = require('simple-mock');
var WPRemote = require('../../wpremote-client.js');
var backupLocations = require('../../backup_locations.json');
var server = null;
var client = null;
var defaultSiteID = 123456;

before(function() {
    // Set test API key and create client
    var apiKey = 'TESTAPIKEY';
    client = new WPRemote(apiKey);

    // Override default baseURL for HTTP(s) requests
    client.baseURL = 'http://localhost:3000/';

    // Create server with port number
    server = require('../server/server')(3000);
});

describe('wp websites', function() {
    it('should get all registered websites', function(done) {
        var callback = function(sites) {
            assert(Array.isArray(sites) && sites.length > 0);
            done();
        };
        client._getSites(callback);
    });

    it('should get one registered websites', function(done) {
        client._getSites(function(sites) {
            assert(Array.isArray(sites) && sites.length == 1);
            done();
        }, defaultSiteID);
    });
});

describe('wp website archive', function() {
    var location;
    var archiveCreationTimeout = 62000;
    var defaultSite;

    before(function(done) {
        // Get first site id from all available sites
        var callback = function(sites) {
            defaultSite = sites[0];
            done();
        };

        client._getSites(callback, defaultSiteID);
        location = {};
    });

    it('should initiate archive creation for single website', function(done) {
        var callback = function(site, location) {
            done();
        };

        client._archiveSingleSite(defaultSite, location, callback);
    });

    it('should have created an archive for single website', function(done) {
        this.timeout(archiveCreationTimeout);
        var checkFrequency = 2000;

        var callback = function(site, body, location) {
            assert(body.url !== '');
            done();
        };

        client._waitForArchiveCreation(defaultSite, callback, archiveCreationTimeout, checkFrequency);
    });

    it('should upload file to AWS S3', function(done) {
        var checkFrequency = 2000;
        this.timeout(archiveCreationTimeout);

        var callback = function(site, url) {
            var onRemoteUploadCompleteCallback = function(File) {
                assert(typeof File !== 'undefined');
                done();
            };

            client._copyArchiveToRemote(defaultSite, url, backupLocations.s3, onRemoteUploadCompleteCallback);
        };

        client._waitForArchiveCreation(defaultSite, callback, archiveCreationTimeout, checkFrequency);
    });

    it('should delete archive from original website', function(done) {
        var callback = function(site, File) {
            done();
        };
        client._deleteSingleSiteArchive(defaultSite, {}, callback);
    });
});

after(function() {
    server.close();
});
