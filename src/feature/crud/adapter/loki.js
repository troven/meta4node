// =============================================================================
// Framework Packages

var _          = require('underscore');     // collections helper
var assert     = require('assert');         // assertions
var helper     = require('meta4helpers');   // files & mixins

// =============================================================================
// Feature Packages

var loki       = require('lokijs');         // loki

var DEBUG = false
exports._db = {}

// =============================================================================
// safely acquire a Collection

exports.getCollection = function(crud, cb) {

	DEBUG && console.log("CRUD:loki", crud.id)
	assert(crud.home, "CRUD Loki required a home")

	// underlying database

	var db = exports._db[crud.id]
	if (db) {
	    // already initialized ..
	    exports._getCollection( crud, db, cb )
	    return
	}

	// initialize database
	var autosaveInterval = crud.adapter.autosaveInterval?crud.adapter.autosaveInterval:3000
	var filename = crud.home+"/"+crud.id+".db"
    helper.files.mkdirs(crud.home)

    // load Loki - callback when done
    db = exports._db[crud.id] = new loki( filename, { autoload: true, autosave: true, autosaveInterval: autosaveInterval,
        autoloadCallback: function() {
		    exports._getCollection( crud, db, cb )
        }
     } );
}

exports._getCollection = function(crud, db, cb) {

	// get our collection
	var collection = db.getCollection( crud.id )
	if (!collection) {
		// if not, create it
		collection = db.addCollection( crud.id )
		_.each(crud.data, function(data) {
			collection.insert(data)
		})
	}

	if (cb) {
		if (!collection)  cb("loki collection not found:"+crud.id, null)
		else cb(null, collection)
	}
	return collection
}

// =============================================================================
// Create

exports.create = function(crud, cmd, cb) {

	exports.getCollection(crud, function(err, collection) {
		if (err) {
			cb && cb( { status: "failed", message: err })
			return false
		}

		DEBUG && console.log("[loki] create:",crud.id, cmd.data)

		var found = collection.insert(cmd.data)

		// externalize ID attribute
		cmd.data[crud.idAttribute] = cmd.data["$loki"]
		DEBUG && console.log("[loki] created:",crud.id, found)

		// we're done
		cb && cb({ status: "success", data: cmd.data, meta: { schema: crud.schema } })

	})

}

// =============================================================================
// Read / GET

exports.read = function(crud, cmd, cb) {

	exports.getCollection(crud, function(err, collection) {

		if (err) {
			cb && cb( { status: "failed" , message: err })
			return false
		}

		DEBUG && console.log("[loki] read:",crud.id, cmd.meta )

		var found = collection.find(cmd.meta)
		DEBUG && console.log("[loki] found:", crud.id, found)

		// we're done
		cb && cb( { status: "success", data: found, meta: { filter: cmd.meta, schema: crud.schema, count: found.length } });
	})
}

// =============================================================================
// Update / PUT

exports.update = function(crud, cmd, cb) {

	exports.getCollection(crud, function(err, collection) {

		if (err) {
			cb && cb( { status: "failed", message: err })
			return false
		}

		DEBUG && console.log("[loki] update:", crud.id, cmd.data)

		var found = collection.update(cmd.data)
		DEBUG && console.log("[loki] updated:", crud.id, cmd.data, found)

		// we're done
		cb && cb( { status: "success", data: cmd.data, meta: { schema: crud.schema } });
	})

}

// =============================================================================
// Delete / DELETE

exports.delete = function(crud, cmd, cb) {

	exports.getCollection(crud, function(err, collection) {

		if (err) {
			cb && cb( { status: "failed", message: err })
			return false
		}

		DEBUG && console.log("[loki] delete:", crud.id, cmd.data)

		var found = collection.removeWhere(cmd.data)
		DEBUG && console.log("[loki] deleted:",crud.id, found)

		// we're done
		cb & cb( { status: "success", data: {}, meta: { schema: crud.schema } });
	})
}
