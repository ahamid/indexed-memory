define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dstore/Memory',
    'lodash'
], function (declare, arrayUtil, Memory, _) {

  function IDX_NAME(field) {
    return "by" + _.upperFirst(field);
  }

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
      this.invalidateIndices();
    },

    _createSubCollection: function (kwArgs) {
      var newCollection = this.inherited(arguments);
      // the new collection is constructed as a clone but not reinitialized
      // call _initIndices (not postscript since that will clear the data array)
      // to construct and rebuild indices specific to this filtered subset
      newCollection._initIndices();
      newCollection.__parent_idx_mem = this
      return newCollection;
    },

    setData: function(data) {
      var result = this.inherited(arguments);
      this.rebuildIndices();
      return result;
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

      this.on('add', this._updated.bind(this));
      this.on('update', this._updated.bind(this));
      this.on('delete', this._updated.bind(this));
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
      var cb = _.iteratee(func || field, undefined, 3);
      var indexFunc = null;
      if (keyGen) {
        indexFunc = _.flow(cb, keyGen);
      } else {
        indexFunc = cb;
      }
      this.addIndex(field, _.partialRight(_.keyBy, indexFunc), keyGen);
    },

    addGroupBy: function (field, func, keyGen, sort) {
      var cb = _.iteratee(func || field, undefined, 3);
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
      var iname = IDX_NAME(field);
      var fname = "getBy" + _.upperFirst(name);
      keyGen = keyGen || (this._indices[field].keyGen || _.identity);
      this._defineIndex(field, iname)
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

    _defineIndex: function(field, iname) {
      var index
      Object.defineProperty(this, iname, {
        get: function() {
          if (!index) {
            var fetched = this.fetchSync();
            var cfg = this._indices[field];
            index = cfg.func(fetched);
            this.emit('rebuilt');
          }
          return index
        },
        set: function(arg) {
          index = arg
        }
      })
    },

    _updated: function() {
      this._conditionallyRebuildIndices()
    },

    _conditionallyRebuildIndices: function () {
      // skip rebuild if either this instance or parent instance is undergoing a bulk operation
      if (this._skipRebuild || (this.__parent_idx_mem && this.__parent_idx_mem._skipRebuild)) {
        this._needsRebuild = true;
      } else {
        this.invalidateIndices();
      }
    },

    _commitRebuildIndices: function () {
      if (this._needsRebuild) {
        this.invalidateIndices();
      }
    },

    invalidateIndices: function() {
      if (this.lazy) {
        this.deleteIndices()
      } else {
        this.rebuildIndices()
      }
    },

    deleteIndices: function() {
      for (var field in this._indices) {
        this[IDX_NAME(field)] = null;
      }
    },

    rebuildIndices: function () {
      var fetched = this.fetchSync();
      this._needsRebuild = false;
      var cfg = null;
      for (var field in this._indices) {
        cfg = this._indices[field];
        this[IDX_NAME(field)] = cfg.func(fetched);
      }
      this.emit('rebuilt');
    }
  });
  return IndexedMemory;
});
