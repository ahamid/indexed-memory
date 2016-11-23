define([
  'intern/dojo/has'
], function (has) {
  return {
    loader: {
      baseUrl: has('host-browser') ? '../..' : '..',
      packages: [
        { name: 'dojo', location: 'node_modules/dojo' },
        { name: 'dstore', location: 'node_modules/dojo-dstore' },
        { name: 'lodash', location: 'node_modules/lodash', main: 'lodash' },
        { name: 'indexed-memory', location: '.', main: 'index' }
      ]
    },
    suites: [ 'test/IndexedMemory' ]
  };
});
