'use strict';

// global error handler
process.on("uncaughtException", function(err) {
	// trace error & kill worker
	console.error("Error [core]", err);
	console.error(err.stack);
	return process.exit(1);
});

var config = require('./config'),
	clusterHelper = require('./src/clusterHelper');

//check for *nix like os
clusterHelper.checkOsNix();

if (clusterHelper.isMaster()) {
	var readyState = false, //master can be treminated
		cl = clusterHelper.cluster;

	// fork workers
	cl.forkWorkers(config.procLimit);

	// setup worker respawner
	cl.setupRespawner();

	// handle sighup to reload workers
	cl.setupSigHupHandler();	

	// master gracefull term
	cl.setupSigIntTermHandler(function() {
		return readyState;
	});

	readyState = true;
} else {

	// switch user if started under root
	if (clusterHelper.isRoot()) {
		clusterHelper.switchUserGroup(config.swUser, config.swGroup);
	}

	var worker = require('./single.js'),
		terminating = false;

	clusterHelper.setupChildMessageHandler(function(cb) {
		// gracefull shutdown http server
		if (!terminating) {
			worker.close(function() {
				cb();
			});
		}
		terminating = true;
	});

}
