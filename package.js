var miniExcludes = {
  'indexed-memory/README.md': 1,
  'indexed-memory/package': 1,
  'indexed-memory/docs': 1
};

var isTestRe = /\/test\//;

// jshint unused: false
var profile = {
  resourceTags: {
    test: function (filename) {
      return isTestRe.test(filename);
    },

    miniExclude: function (filename, mid) {
      return isTestRe.test(filename) || mid in miniExcludes;
    },

    amd: function (filename) {
      return /\.js$/.test(filename);
    }
  }
};
