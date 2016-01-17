define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dstore/Memory',
    'lodash'
], function (declare, arrayUtil, Memory, _) {
  var IndexedMemory = declare(Memory, {
    postscript: function () {
      this.inherited(arguments);

      this._constructIndices();

      this.regenerateIndices();
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

      this.on('add', this.regenerateIndices.bind(this));
      this.on('update', this.regenerateIndices.bind(this));
      this.on('delete', this.regenerateIndices.bind(this));
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

    regenerateIndices: function () {
      var cfg = null;
      for (var field in this._indices) {
        cfg = this._indices[field];
        this["by" + field] = cfg.func(this.data);
      }
      //@_updated()
    }
  });
  return IndexedMemory;
});