var self = module.exports = {}

// =============================================================================
// framework packages

var _          = require('underscore');     // collections helper
var assert     = require('assert');         // assertions

// =============================================================================
// meta4 packages

var helpers     = require('meta4helpers');      // utilities

// =============================================================================

self.__features = {}

self.register = function(key, feature) {
	exports.__features[key] = feature
}

self.install = function(config) {
	self.defaults(config)

    if(!config.features) return;
    assert(config.home, "Feature.install is missing {{home}}")

    var sorted = _.sortBy( _.values(features) , function(a) { return a.order?a.order:a.path.length })
    _.each(sorted, function(feature) {
        var fn   = self.__features[feature.package] || require(feature.requires);
        if (fn && fn.install) {
            fn.install(feature, config)
        }
    })
}

self.defaults = function(config) {
    assert(config.home, "Feature.defaults is missing {{home}}")

    var features = config.features = config.features || {}

    // configure API
    features.apis = _.extend({
        path: "/api",
        home: config.home+"/api"
    }, features.apis)

    // configure CRUD
    features.crud = _.extend({
        path: "/models",
        requires: "./feature/crud",
        home: config.home+"/models/meta",
        data: config.home+"/models/data",
    }, features.crud)


    // configure UX
    features.ux = _.extend({
        path: "/ux",
        requires: "meta4ux",
        home: config.home,
        paths: {
            models: config.home+"/models/meta",
            data: config.home+"/models/data",
            templates: config.home+"/templates/client",
            scripts: config.home+"/scripts",
            views: config.home+"/views"
        }
    }, features.ux)
    features.ux.crud = features.crud.path

    // configure Assets
    features.assets = _.extend({
        path: "/",
        home: config.home+"/public"
    }, features.assets)


    // configure Logins
    features.auth = _.extend({
        disabled: true,
        path: "/",
        paths: {
            index:  "/",
            home:   "/home",
            login:  "/login",
            logout: "/logout",
            signup: "/signup"
        }
    }, features.auth)
}

self.configure = function(router, config) {

    assert(config.home, "Feature.configure is missing {{home}}")

    // default configuration
    var features = config.features = config.features || {}
	self.defaults(config)

    // =============================================================================
    // Load and configure Feature

    // ensure feature's have both a package & a path
    _.each(features, function(options, key) {
        options.path = options.path || "/"+key
        options.requires = options.requires || options.package || './feature/'+key
        options.package = options.package || key
        if (options.home) helpers.files.mkdirs(options.home)
    });

    // match longest (most specific) paths first
    var sorted = _.sortBy( _.values(features) , function(a) { return a.order?a.order:a.path.length })
    console.log("[meta4] features:", _.pluck(sorted, "package"))

    // naively prioritize routes based - shortest paths first
    _.each(sorted, function(options) {

        if (options.disabled) { console.log("[meta4] disabled:", options.package); return; }

        var fn   = self.__features[options.package] || require(options.requires);

        console.log("[meta4] enabled :", options.package, " -> ", options.path, "@", options.home)
        if (fn.feature) {
            fn.install && fn.install(options, config)
            try {
	            fn.feature(router, options, config)
            } catch(e) {
                console.log("Feature Failed", options.package, e)
            }
        } else throw "not a meta4 feature: "+options.requires
    })

    return
}
