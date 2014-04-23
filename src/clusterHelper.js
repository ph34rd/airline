'use strict';

var os = require('os'),
	cluster = require('cluster');

exports.checkOsNix = function() {
	if (([ 'linux', 'darwin' ]).indexOf(os.platform()) == -1) {
		console.error('Error [cluster] *nix like OS required');
		process.exit(1);
	}
};

exports.isRoot = function() {
	if (process.getuid && (process.getuid() === 0)) {
		return true;
	} else {
		return false;
	}
};

exports.switchUserGroup = function(user, group) {
	if (process.setgid && process.setuid) {
		try {
			process.setuid(user);
		} catch (err) {
			console.error('Error [cluster] failed to set uid: ' + err.stack);
		}

		try {
			process.setuid(group);
		} catch (err) {
			console.error('Error [cluster] failed to set gid: ' + err.stack);
		}
	}
};

exports.numCPUs = function() {
	return os.cpus().length;
};

exports.isMaster = function() {
	return cluster.isMaster;
};

exports.setupChildMessageHandler = function(gracefulShutdownFunction) {
	process.on('SIGINT', function() {
		// ignore SIGINT
	});
	process.on('SIGTERM', function() {
		// ignore SIGTERM
	});
	process.on('SIGHUP', function() {
		// ignore SIGHUP
	});	
	process.on('message', function(msg) {
		if (msg.cmd) {
			switch (msg.cmd) {
				case 'stop':
					console.log("Info [cluster] received STOP signal from master, pid", process.pid);

					// exit after shutdown function
					gracefulShutdownFunction(function() {
						console.log("Info [cluster] shutdown done, pid", process.pid);
						process.exit(0);
					});
					break;
				case 'kill':
					console.log("Info [cluster] received KILL signal from master, pid", process.pid);
					process.exit(0);
					break;
				default:
			}
		}
	});
};

var cl = function() {
	this.sigint = false;
	this.workerList = [];
	this.childrenDied = false;
};

// internal function
var removeWorkerFromListByPid = function(workerList, pid) {
	var counter = -1;
	workerList.forEach(function(worker) {
		++counter;
		if (worker.process.pid === pid) {
			workerList.splice(counter, 1);
		}
	});
};

cl.prototype = {
	forkWorkers: function(limit) {
		var self = this,
			numCPUs = limit || exports.numCPUs();

		//fork workers
		for (var i = 0; i < numCPUs; i++) {
			var env = process.env,
				newWorker = cluster.fork(env);
			self.workerList.push(newWorker);

			console.info('Info [cluster] workerer with pid', newWorker.process.pid, 'started');
		}
	},
	setupRespawner: function() {
		var self = this;

		cluster.on('exit', function(worker, code, signal) {
			if (self.sigint) {
				console.log('Info [cluster] worker with pid', worker.process.pid, 'terminated');
				removeWorkerFromListByPid(self.workerList, worker.process.pid);
				if (self.workerList.length === 0) {
					self.childrenDied = true;
				}
				return;
			}

			console.log('Info [cluster] worker with pid', worker.process.pid, 'died, respawning...');

			var newWorker = cluster.fork();
			removeWorkerFromListByPid(self.workerList, worker.process.pid);
			self.workerList.push(newWorker);
		});	
	},
	sendStopToWorkers: function() {
		this.workerList.forEach(function(worker) {
			console.log('Info [cluster] sending STOP message to worker pid', worker.process.pid);
			worker.send({ cmd: 'stop' });
		});
	},
	sendKillToWorkers: function() {
		this.workerList.forEach(function(worker) {
			console.log('Info [cluster] sending KILL message to worker pid', worker.process.pid);
			worker.send({ cmd: 'kill' });
		});
	},	
	setupSigHupHandler: function() {
		var self = this;

		process.on('SIGHUP', function() {
			console.log('Info [cluster] received SIGHUP from system, reloading workers...');
			self.sendStopToWorkers();
		});
	},
	setupSigIntTermHandler: function(masterCanBeTerminated) {
		var self = this;

		process.on('SIGINT', function() {
			self.sigint = true;
			console.log('Info [cluster] received SIGINT from system, gracefull terminating...');
			self.sendStopToWorkers();

			setInterval(function() {
				if ((self.childrenDied) && (masterCanBeTerminated())) {
					process.exit(0);
				}
			}, 1000);
		});

		process.on('SIGTERM', function() {
			self.sigint = true;
			console.log('Info [cluster] received SIGTERM from system, kill terminating...');
			self.sendKillToWorkers();

			setInterval(function() {
				if ((self.childrenDied) && (masterCanBeTerminated())) {
					process.exit(0);
				}
			}, 1000);
		});
	}
};

exports.cluster = new cl();
