'use strict';

module.exports = function(grunt){
    grunt.initConfig({
        mocha_istanbul: {
            coverage: {
                src: ['test/tests/index.test.js', 'test/tests/**/*.test.js'],
                options: {
                    coverageFolder: 'coverage',
                    timeout: 30000
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-mocha-istanbul');

    grunt.registerTask('coverage', ['mocha_istanbul:coverage']);
};
