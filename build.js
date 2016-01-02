global.dojoConfig = {
  baseUrl: require.resolve('./bower_components/dojo/dojo').replace(/dojo\/dojo\.js$/, ''),
  packages: [{
    name: 'dojo',
    location: './dojo'
  },{
    name: 'build',
    location: './dojo-util/build'
  }]
};

console.log(process.argv);
process.argv[3] = 'profile=./package.js';
process.argv[2] = 'load=build';

console.log(process.argv);
require('./bower_components/dojo/dojo');
