var profile = {
  resourceTags: {
    test: function (filename, mid) {
      return /\/test\//.test(filename);
    },

    miniExclude: function (filename, mid) {
      return /\/(?:tests|demos|docs)\//.test(filename);
    },

    amd: function (filename, mid) {
      return /\.js$/.test(filename);
    }
  }
};
