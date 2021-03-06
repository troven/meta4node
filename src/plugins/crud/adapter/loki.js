// =============================================================================
// Framework Packages

var _          = require('underscore');     // collections helper
var assert     = require('assert');         // assertions
var helper     = require('meta4common');   // files & mixins
var debug      = require("../../../debug")("crud:loki");
var paths      = require("path");

// =============================================================================
// Feature Packages

var loki       = require('lokijs');

var self = exports;
self.idAttribute = "$loki";
self._db = {};

// =============================================================================
// safely acquire a Collection

self.getCollection = function(crud, db) {
	// get our collection
	var collection = db.getCollection( crud.id );
	if (!collection) {
		// if not, create it
		collection = db.addCollection( crud.id );
	};

	return collection
}


self.acquireDatabase = function(crud, cb) {
    assert(crud, "Missing CRUD");
    assert(crud.id, "Missing CRUD id");
    assert(crud.idAttribute, "Missing LOKI idAttribute");

    assert(cb, "Missing CRUD callback: "+crud.id);
    assert(_.isFunction(cb), "Missing CRUD callback: "+crud.id);

	var home = crud.adapter.home || crud.home;
    assert(home, "Loki CRUD @ "+crud.id+" is missing home");

    var DEBUG = crud.debug?true:false;

	// underlying database

	var db = exports._db[crud.id]
	if (db) {
		// already initialized ..
		cb && cb(null, db)
	    return;
	}

	// initialize database
	var autosaveInterval = crud.adapter.autosaveInterval?crud.adapter.autosaveInterval:3000

	// file management
//	crud.adapter.database.name
    helper.files.mkdirs(home);
	var filename = paths.resolve(paths.normalize(home+"/"+crud.id+".json"));
    DEBUG && debug("%s @ %j --> %s", crud.id, home, filename);


    // load Loki - callback when done
    db = exports._db[crud.id] = new loki( filename, { autoload: true, autosave: true, autosaveInterval: autosaveInterval,
        autoloadCallback: function() {
            DEBUG && debug("acquired: %s", crud.id); // , db.collections, arguments
	        cb && cb(null, db);
        }
     } );
}

// =============================================================================
// Create

exports.create = function(crud, cmd, cb) {

    var DEBUG = crud.debug;

	self.acquireDatabase(crud, function(err, db) {
		if (err) {
			cb && cb( { status: "failed", err: err });
			return false;
		}

//		debug("create:",crud.id, cmd.data);

        var collection = self.getCollection(crud, db);
		var found = collection.insert(cmd.data)

		// externalize ID attribute
        DEBUG && debug("created %s -> %j",crud.id, found);

		// we're done
		cb && cb(null, { status: "success", data: [cmd.data], meta: {  } })

	})

}

// =============================================================================
// Read / GET

exports.read = function(crud, cmd, cb) {
    assert(crud, "Missing CRUD");
    assert(cmd, "Missing command");
    assert(cb, "Missing callback");
    assert(_.isFunction(cb), "Invalid callback: "+JSON.stringify(cb));
    assert(crud.adapter, "Missing adapter");
    assert(crud.adapter.type, "Invalid adapter");
    assert(crud.adapter.home, "Missing loki home");

    var DEBUG = crud.debug?true:false;

	self.acquireDatabase(crud, function(err, db) {

		if (err) {
			cb && cb( { status: "failed" , err: err });
			return false
		}
		assert(db, "Missing loki database: "+crud.id);

  		var collection = self.getCollection(crud, db);
        if (!collection) {
            cb && cb( { status: "failed" , err: "missing "+crud.id } );
            return;
        }
        assert(collection.name==crud.id, "Collection name mismatched: "+collection.name);

        var where = _.extend({}, cmd.where, crud.where);
        var filters = _.extend({}, cmd.filters, crud.filters);

        DEBUG && debug("read %s", crud.id);
        var found = where?collection.find(where):collection.data;
        found = found || [];
        DEBUG && debug("found %s x %s", found.length, crud.id);

		// we're done
		cb && cb( null, { status: "success", data: found });
	})
}

// =============================================================================
// Update / PUT

exports.update = function(crud, cmd, cb) {

    var DEBUG = crud.debug?true:false;

    self.acquireDatabase(crud, function(err, db) {

		if (err) {
			cb && cb( { status: "failed", err: err });
			return false
		}

        DEBUG && debug("update:", crud.id, cmd.data)

        var collection = self.getCollection(crud, db);
        DEBUG && debug("update %s -> %j", crud.id, cmd.data);

		var found = collection.update(cmd.data);
		// we're done
		cb && cb( null, { status: "success", data: [cmd.data], meta: { count: found } });
	})

}

// =============================================================================
// Delete / DELETE

exports.delete = function(crud, cmd, cb) {

    var DEBUG = crud.debug?true:false;

    self.acquireDatabase(crud, function(err, db) {

		if (err) {
			cb && cb( { status: "failed", err: err });
			return false
		}

        DEBUG && debug("delete: %s -> %s", crud.id, cmd.data[crud.idAttribute]);

        var collection = self.getCollection(crud, db);
		var found = collection.removeWhere(cmd.data)
        DEBUG && debug("deleted: %s -> %j",crud.id, found)

		// we're done
		cb & cb( null, { status: "success", data: [], meta: { deleted: found?found:false } });
	})
}

// =============================================================================
// Initial Install

exports.install = function(crud, feature, cb) {
    assert(crud, "Missing CRUD");
    assert(feature, "Missing CRUD feature: "+crud.id);
    assert(cb, "Missing CRUD callback: "+crud.id);
    assert(_.isFunction(cb), "Invalid CRUD callback: "+crud.id);

    var DEBUG = crud.debug?true:false;

    if (!crud.defaults) {
         return;
    };

    self.acquireDatabase(crud, function(err, db) {
        if (err) {
            cb && cb( err, { status: "failed", err: err });
            return false
        }

        crud.defaults = crud.defaults || [];
        var collection = self.getCollection(crud, db);
        if (!collection.count()) {
            DEBUG && debug("installing: %s from %o ", crud.id, crud.defaults);

            if (_.isString(crud.defaults)) {
                helper.files.parse(crud.defaults, function(file, json) {
                    //DEBUG &&
                    debug("installed x %s models from : %s as %s", _.keys(json).length, file, crud.id);
                    _.each(json, function(data) {
                        collection.insert(data);
                    });
                });
            }

            if (_.isArray(crud.defaults)) {
                _.each(crud.defaults, function(data) {
                    collection.insert(data);
                });
                DEBUG && debug("installed: %s x %s models", _.keys(crud.defaults).length, crud.id);
            }
        }

        // we're done
        cb && cb(null, { status: "pending", data: crud.defaults, meta: {  } })
    })
}

return self;
