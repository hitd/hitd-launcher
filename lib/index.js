var handle = require('hitd-handler'),
	debug = require('hitd-debug')('hitd-launcher');

var async = require('async');
var cache = {};

var launch = module.exports = function(endpoint, conf, cb) {

	var rules = {};

	rules['hitd-launcher/launch'] = function(key, req, cb) {
		debug('request to launch something', req.body.name);

		local(req.body.name, req.body.endpoint, req.body.conf, function(err) {
			if (err) {

				cb(null, 404, JSON.stringify(err));
				return;
			}
			cb(null, 200, 'ok');
		})
	};

	rules['hitd-launcher/relaunchFile'] = function(key, req, cb) {
		debug('request to relaunch something');
		local.relaunch(typeof req.body === 'string' ? req.body : req.body.name,
			function(err) {
				cb(null, 200, 'ok');
			});
	};


	rules['hitd-launcher/stop'] = function(key, req, cb) {
		debug('request to stop something');
		local.stop(typeof req.body === 'string' ? req.body : req.body.name,
			function(err, message) {
				cb(null, 200, message);
			});
	};

	rules['hitd-launcher/relaunchModule'] = function(key, req, cb) {
		debug('request to relaunch something');
		try {
			var mod = require.resolve(typeof req.body === 'string' ? req.body : req.body
				.name)
			local.relaunch(mod,
				function() {
					cb(null, 200, 'ok');
				});
		} catch (err) {
			cb(err, 500, err.toString());
		}
	};

	handle(endpoint, conf, rules, cb);

};

module.exports.local = local;
var local = function(modulename, inport, conf, callback) {
	var _path;

	try {
		_path = require.resolve(modulename);
	} catch (err) {
		return callback(err);
	}
	var MyModule = undefined;
	async.whilst(function() {
		return !MyModule;
	}, function(cb) {
		try {
			MyModule = require(modulename);
			cb();
		} catch (err) {
			console.error(err);
			debug('require failed : %s', err);
			setTimeout(cb, 500);
		}
	}, function() {


		cache[_path] = cache[_path] || [];
		var obj = {
			name: modulename,
			module: MyModule,
			inport: inport,
			conf: conf,
			callback: callback
		};

		cache[_path].push(obj);

		debug('module %s will loaded', modulename);
		(MyModule.start || MyModule)(inport, conf, function(err, methodes) {
			if (methodes) {
				obj.methodes = methodes;
			}
			callback();
		});
	});

};


local.relaunch = function(filename, cb) {
	var cached = cache[filename] || [];
	cache[filename] = [];

	if (cached) {
		delete require.cache[filename];
	};

	cached.forEach(function(instance) {
		debug('instance %s will be hot reloaded', filename);

		var next = function() {
			setTimeout(function() {
				local(filename, instance.inport, instance.conf, function() {
					debug('instance %s was hot reloaded', filename);
					(cb || function() {})();
				});
			}, 100);
		};

		if (instance.methodes && instance.methodes.stop) {
			instance.methodes.stop(function() {
				debug('instance %s stopping before hot reloading', filename);
				next();
			});
		} else {
			next();
		}
	});
};

local.stop = function(modulename, cb) {
	var filename = require.resolve(modulename);
	var cached = cache[filename] || [];
	if (!cached) {
		return cb();
	}

	var hasmodule = false;
	async.each(cached, function(instance, cb) {
			debug('instance is', instance, instance.methodes);
			if (instance.methodes && instance.methodes.stop) {
				hasmodule = true;
				instance.methodes.stop(cb);
			} else {
				cb();
			}
		},
		function() {
			cb(null, hasmodule);
		});
};

module.exports.local = local;
