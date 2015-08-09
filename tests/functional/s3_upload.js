// force the test environment to 'test'
var async = require('async');
var assert = require("assert");
var simple = require('simple-mock');
var WPRemote = require('../../wpremote-client.js');
var backupLocations = require('../../backup_locations.json');

var client = null;

before(function() {
    var apiKey = '3A891BD055ACC83DB99F7C10C25C7499';
    client = new WPRemote(apiKey);
    client.baseURL = 'http://localhost:3000/';
    var server = require('../server/server')();
});

describe('wp websites', function() {
    this.timeout(20000);

    it('should get all registered websites', function(done) {
        var callback = function(sites) {
            assert(Array.isArray(sites) && sites.length > 0);
            done();
        };
        client._getSites(callback);
    });

    it('should get one registered websites', function(done) {
        var siteID = 123456;

        client._getSites(function(sites) {
            assert(Array.isArray(sites) && sites.length == 1);
            done();
        }, siteID);
    });
});

describe('wp website archive', function() {
    this.timeout(20000);
    var location;
    var site;

    before(function(done) {
        // Get first site id from all available sites
        var callback = function(sites) {
            site = sites[0];
            done();
        };

        client._getSites(callback);

        // init the location object
        // location = new location_s3(backupLocations.s3);

        // stub the location object
        // simple.mock(location, 'upload').callFn(function(file, callback) {
        //     var File = function() {};
        //     callback(new File());
        // });

        location = {};
    });

    it('should initiate archive creation for single website', function(done) {
        var callback = function(site, location) {
            done();
        };

        client._archiveSingleSite(site, location, callback);
    });

    it('should have created an archive for single website', function(done) {
        var timeout = 60000;
        this.timeout(timeout);

        var callback = function(site, body, location) {
            assert(body.url !== '');
            done();
        };

        client._waitForArchiveCreation(site, location, callback, timeout, 2000);
    });

    it('should delete archive from original website', function(done) {
        client._deleteSingleSiteArchive(site, {}, done);
    });
});


describe('wp website archive', function() {
    this.timeout(20000);
    var site;

    before(function(done) {
        // Get first site id from all available sites
        var callback = function(sites) {
            site = sites[0];
            done();
        };

        client._getSites(callback);
    });


    it('should upload file to AWS S3', function(done) {
        var url = 'http://samplecsvs.s3.amazonaws.com/Sacramentorealestatetransactions.csv';
        var callback = function(site, File) {
            done();
        };

        client._copyArchiveToRemote(site, url, backupLocations.s3, callback);
    });
});
