'use strict';

module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			options: {
				evil: true,
				regexdash: true,
				browser: true,
				wsh: true,
				trailing: true,
				sub: true,
				globalstrict: true,
				node: true,
				strict: true
			},
			all: [ 'Gruntfile.js', 'main.js', 'src/*.js' ]
		},
		jscs: {
			options: {
				config: ".jscs.json",
			},
			src: [ 'Gruntfile.js', 'main.js', 'src' ]
		},
		copy: {
			build: {
				files: [
					{ expand: true, src: [ 'src/*' ], dest: 'build/', filter: 'isFile' },
					{ expand: true, src: [ 'public/**' ], dest: 'build/', filter: 'isFile' },
					{ expand: true, src: [ 'views/**' ], dest: 'build/', filter: 'isFile' },
					{ expand: true, src: [ 'nginx/**' ], dest: 'build/', filter: 'isFile' },
					{ expand: true, src: [ '*', '!Gruntfile.js' ], dest: 'build/', filter: 'isFile' }
				]
			}
		},
		clean: {
			build: {
				src: [ 'build/*' ]
			}
		}		
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-jscs-checker');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.registerTask('default', [ 'jshint', 'jscs' ]);
	grunt.registerTask('npm-production', 'install build dependencies', function() {
		var exec = require('child_process').exec;
		var cb = this.async();
		exec('npm install --production', { cwd: './build' }, function(err, stdout, stderr) {
			console.log(stdout);
			cb();
		});
	});
	grunt.registerTask('build', [ 'copy', 'npm-production' ]);
};
