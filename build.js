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

params = process.argv.slice(2);
if (!params.length) {
  params = ['profile=./package.js']
}
process.argv.splice(2);
process.argv[2] = 'load=build';
process.argv.push.apply(process.argv, params);

require('./bower_components/dojo/dojo');
