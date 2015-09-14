var request = require( 'request' ),
    _ = require( 'lodash' ),
    path = require( 'path' ),
    pkgcloud = require( 'pkgcloud' );
var LOG = require( path.resolve( 'utils', 'log.js' ) );

var client = function ( config ) {
    if ( !config || _.isUndefined( config.keyId ) || _.isUndefined( config.key ) || _.isUndefined( config.provider ) ) {
        throw Error( "Missing S3 config" );
    }
    this.config = config;
    this.client = pkgcloud.storage.createClient( config );
};

/* use a function for the exact format desired... */
client.prototype = {
    paddedDate: function ( d ) {
        function pad( n ) {
            return n < 10 ? '0' + n : n;
        }
        return d.getFullYear() + '-' + pad( d.getMonth() + 1 ) + '-' + pad( d.getDate() );
    },
    upload: function ( file, callback ) {
        var date = new Date();

        var folderName = this.paddedDate( date );
        var bucketObjLocation = path.join( folderName, path.basename( file ) );

        var params = {
            container: this.config.container,
            remote: bucketObjLocation
        };

        var readStream = request( file )
            .on( 'error', function ( err ) {
                throw err;
            } );

        var writeStream = this.client.upload( params );
        writeStream.on( 'error', function ( err ) {
            throw err;
        } ).on( 'success', callback );
        LOG( 'Remote upload has started for', bucketObjLocation );
        readStream.pipe( writeStream );
    },
    removeExpiredBackups: function ( days ) {
        if ( isNaN( days ) || days <= 0 ) {
            LOG( "The expiration in days was invalid. Please choose a number greater than or equal to 0 and that is an integer." );
            return;
        }

        // List objects with prefix
        var checkDate = new Date( new Date().setDate( new Date().getDate() - days ) );

        var options = {
            marker: checkDate.getFullYear().toString(),
            prefix: '20',
            delimiter: '/'
        };

        var self = this;

        this.client.getFiles( this.config.container, options, function ( err, files ) {
            files.forEach( function ( file ) {
                var path = file.name.split( '/' );
                var fileDate = new Date( path[ 0 ] );
                if ( fileDate instanceof Date && isFinite( fileDate ) && fileDate < checkDate ) {
                    self.client.removeFile( self.config.container, file.name, function ( err ) {
                        LOG( 'Removed', file.name, 'with error', err );
                    } );
                }

            } );
        } );

    }
};

module.exports = client;
