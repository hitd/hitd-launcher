var inport = process.env['INPORT_LISTEN'] || 'ipc:///tmp/routein' || 'tcp://127.0.0.1:12345';

var Module = require('..');
var Package = require('./package.json');

var moduleName = Package.name;
var debug = require('hitd-debug')(moduleName);

new Module(moduleName , inport, { heartbeat : 30 } , function(){
	debug("started");
});
