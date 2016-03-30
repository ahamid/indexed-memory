define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dstore/Memory',
    'lodash'
], function (declare, arrayUtil, Memory, _) {
  var IndexedMemory = declare(Memory, {
    constructor: function () {
      this._skipRebuild = false;
      this._needsRebuild = false;
    },

    postscript: function () {
      this.inherited(arguments);

      this._initIndices()
    },

    _initIndices: function() {
      this._constructIndices();
      this.rebuildIndices();
    },

    _createSubCollection: function (kwArgs) {
      var newCollection = this.inherited(arguments);
      // the new collection is constructed as a clone but not reinitialized
      // call _initIndices (not postscript since that will clear the data array)
      // to construct and rebuild indices specific to this filtered subset
      newCollection._initIndices();
      return newCollection;
    },

    _constructIndices: function () {
      var indexDefs = this.indices || [];

      arrayUtil.forEach(indexDefs, function (cfg) {
        var type = cfg.type || 'index';
        switch (type) {
          case 'index': {
            this.addIndexBy(cfg.field, cfg.key, cfg.keyGen);
            break;
          }
          case 'group': {
            this.addGroupBy(cfg.field, cfg.key, cfg.keyGen, cfg.sort);
            break;
          }
          default: {
            throw new TypeError('Invalid index type: ' + type);
          }
        }
      }, this);

      this.on('add', this._conditionallyRebuildIndices.bind(this));
      this.on('update', this._conditionallyRebuildIndices.bind(this));
      this.on('delete', this._conditionallyRebuildIndices.bind(this));
    },

    addBulkSync: function (objects, options) {
      this._bulkOp('addSync', objects, options);
    },

    putBulkSync: function (objects, options) {
      this._bulkOp('putSync', objects, options);
    },

    removeBulkSync: function (ids) {
      this._bulkOp('removeSync', ids);
    },

    _bulkOp: function(op, objects, options) {
      this._skipRebuild = true;
      try {
        var that = this;
        arrayUtil.forEach(objects, function (object) {
          that[op](object, options);
        });
      } finally {
        this._skipRebuild = false;
        this._commitRebuildIndices();
      }
    },

    addIndexBy: function (field, func, keyGen) {
      var cb = _.callback(func || field, undefined, 3);
      var indexFunc = null;
      if (keyGen) {
        indexFunc = _.flow(cb, keyGen);
      } else {
        indexFunc = cb;
      }
      this.addIndex(field, _.partialRight(_.indexBy, indexFunc), keyGen);
    },

    addGroupBy: function (field, func, keyGen, sort) {
      var cb = _.callback(func || field, undefined, 3);
      var indexFunc = null;
      if (keyGen) {
        indexFunc = _.flow(cb, keyGen);
      } else {
        indexFunc = cb;
      }

      var group = _.partialRight(_.groupBy, indexFunc);

      var f = null;
      if (sort) {
        f = function (records) {
          return _.mapValues(group(records), function (vals) {
            return _.sortBy(vals, sort);
          });
        };
      } else {
        f = group;
      }
      this.addIndex(field, f, keyGen, []);
    },

    addIndex: function (field, func, keyGen, dflt) {
      (this._indices = (this._indices || {}))[field] = {func: func};
      if (keyGen) {
        this._indices[field].keyGen = keyGen;
      }
      this._addAccessor(field, undefined, undefined, dflt);
    },

    _addAccessor: function (field, name, keyGen, dflt) {
      name = name || field;
      var iname = "by" + _.capitalize(field);
      var fname = "getBy" + _.capitalize(name);
      keyGen = keyGen || (this._indices[field].keyGen || _.identity);
      var that = this;
      var accessor = null;
      if (dflt) {
        accessor = function (arg) {
          return that[iname][keyGen(arg)] || dflt
        };
      } else {
        accessor = function (arg) {
          return that[iname][keyGen(arg)];
        };
      }
      this[fname] = accessor
    },

    _conditionallyRebuildIndices: function () {
      if (this._skipRebuild) {
        this._needsRebuild = true;
      } else {
        this.rebuildIndices();
      }
    },

    _commitRebuildIndices: function () {
      if (this._needsRebuild) {
        this.rebuildIndices();
      }
    },

    rebuildIndices: function () {
      var fetched = this.fetchSync();
      this._needsRebuild = false;
      var cfg = null;
      for (var field in this._indices) {
        cfg = this._indices[field];
        this["by" + field] = cfg.func(fetched);
      }
      this.emit('rebuilt');
    }
  });
  return IndexedMemory;
});