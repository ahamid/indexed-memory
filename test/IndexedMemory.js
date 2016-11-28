define([
  'intern!tdd',
  'intern/chai!assert',
  'dojo/_base/declare',
  'dojo/Deferred',
  'lodash',
  'indexed-memory'
], function (test, assert, declare, Deferred, _, IndexedMemory) {
  [false, true].forEach(function(lazy) {
    var TestMemory = declare(IndexedMemory, {
      idProperty: 'PID',
      lazy: lazy,
      indices: [
        { field: 'Name', key: 'Info.Name', keyGen: function (name) { return name.toUpperCase(); }},
        { type: 'group', field: 'Gender', key: 'Gender', sort: 'Info.Name' },
        { type: 'group',
          field: 'Country',
          key: 'Country',
          keyGen: function (country) { return country.toUpperCase(); },
          sort: function (record) { return -record.PID; /* reverse sort by PID */ }
        }
      ],
      _updated() {
        this.inherited(arguments)
        if (this._updateCount == null) this._updateCount = 0
        this._updateCount++
      }
    });

    var RECORDS = [{
      PID: 1,
      Info: { Name: 'Alan' },
      Gender: 'M',
      Country: 'usa'
    }, {
      PID: 2,
      Info: {Name: 'Beth'},
      Gender: 'F',
      Country: 'USA'
    },{
      PID: 3,
      Info: { Name: 'Carl' },
      Gender: 'M',
      Country: 'Canada'
    },{
      PID: 4,
      Info: {Name: 'Debra'},
      Gender: 'F',
      Country: 'Mexico'
    }];

    test.suite('IndexedMemory (lazy: ' + lazy + ')', function () {
      test.test('#constructor - generates accessors', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});
        assert.equal(s.getSync(1), RECORDS[0]);
        assert.isFunction(s.getByName);
        assert.equal(s.getByName('CarL'), RECORDS[2]);
        assert.isFunction(s.getByGender);
        assert.sameMembers(s.getByGender('M'), [RECORDS[0], RECORDS[2]]);
        assert.isFunction(s.getByCountry);
        assert.sameMembers(s.getByCountry('uSa'), [RECORDS[1], RECORDS[0]]);
      });


      test.test('#constructor - empty constructor created indices', function () {
        var s = new TestMemory();
        assert.ok(s.byName);
        assert.ok(s.byGender);
      });

      test.test('#constructor - indexes all records', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});
        assert.sameMembers(s.data, RECORDS);

        assert.equal(s.getSync(1), RECORDS[0]);
        assert.equal(s.getSync(2), RECORDS[1]);
        assert.equal(s.getSync(3), RECORDS[2]);
        assert.equal(s.getSync(4), RECORDS[3]);

        assert.deepEqual(s.byName, {
          ALAN: RECORDS[0],
          BETH: RECORDS[1],
          CARL: RECORDS[2],
          DEBRA: RECORDS[3]
        });

        assert.deepEqual(s.byGender, {
          M: [RECORDS[0], RECORDS[2]],
          F: [RECORDS[1], RECORDS[3]]
        });

        assert.deepEqual(s.byCountry, {
          USA: [RECORDS[1], RECORDS[0]], // reverse sorted
          CANADA: [RECORDS[2]],
          MEXICO: [RECORDS[3]]
        });
      });

      test.test('groupBy index defaults to empty array', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});
        assert.deepEqual(s.getByGender('?'), []);
      });

      test.test('#add', function() {
        var s = new TestMemory({data: [RECORDS[0]]});

        var record = {
          PID: 5,
          Info: { Name: 'Eric' },
          Gender: 'M',
          Country: 'Germany'
        };

        s.addSync(record);

        assert.equal(s._updateCount, 1)
        assert.sameMembers(s.data, [record, RECORDS[0]]);
        assert.equal(s.getSync(1), RECORDS[0]);
        assert.equal(s.getSync(5), record);
        assert.deepEqual(s.byName, {
          ALAN: RECORDS[0],
          ERIC: record
        });
        assert.sameMembers(s.byGender.M, [record, RECORDS[0]]);
      });

      test.test('#remove', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});
        var timesRebuilt = 0;
        s.on('rebuilt', function() { timesRebuilt++; });
        s.removeBulkSync([RECORDS[1].PID, RECORDS[2].PID]);
        assert.equal(s._updateCount, 2)
        assert.equal(timesRebuilt, lazy ? 0 : 1, 'bulk operation resulted in unexpected # of rebuilds');

        assert.sameMembers(s.data, [RECORDS[0], RECORDS[3]]);
        assert.equal(s.getSync(1), RECORDS[0]);
        assert.equal(s.getSync(4), RECORDS[3]);

        assert.deepEqual(s.byName, {
          ALAN: RECORDS[0],
          DEBRA: RECORDS[3]
        });

        assert.deepEqual(s.byGender, {
          M: [RECORDS[0]],
          F: [RECORDS[3]]
        });

        assert.ok(timesRebuilt > 0, 'rebuilt should have been fired for one or more indices');
      });

      test.test('#update', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});

        var updatedRecord = {
          PID: 3,
          Info: {Name: 'Frankie'},
          Gender: 'F',
          Country: 'Mexico'
        };

        s.putSync(updatedRecord);

        assert.equal(s._updateCount, 1)
        assert.sameMembers(s.data, [RECORDS[0], RECORDS[1], updatedRecord, RECORDS[3]]);
        assert.equal(s.getSync(1), RECORDS[0]);
        assert.equal(s.getSync(2), RECORDS[1]);
        assert.equal(s.getSync(3), updatedRecord);
        assert.equal(s.getSync(4), RECORDS[3]);

        assert.deepEqual(s.byName, {
          ALAN: RECORDS[0],
          BETH: RECORDS[1],
          DEBRA: RECORDS[3],
          FRANKIE: updatedRecord
        }, 'reindexed Name');

        assert.sameMembers(s.byGender.M, [RECORDS[0]]);
        assert.deepEqual(s.byGender.F, [RECORDS[1],RECORDS[3],updatedRecord]);

        assert.deepEqual(s.byCountry, {
          USA: [RECORDS[1], RECORDS[0]], // reverse sorted
          MEXICO: [RECORDS[3], updatedRecord]
        });
      });

      test.test('"upsert"', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});

        var updatedRecord = {
          PID: 3,
          Info: {Name: 'Frankie'},
          Gender: 'F',
          Country: 'Canada'
        };

        var addedRecord = {
          PID: 5,
          Info: {Name: 'Eric'},
          Gender: 'M',
          Country: 'Germany'
        };

        var timesRebuilt = 0;
        s.on('rebuilt', function() { timesRebuilt++; });
        s.putBulkSync([updatedRecord, addedRecord]);
        assert.equal(s._updateCount, 2)
        assert.equal(timesRebuilt, lazy ? 0 : 1, 'bulk operation resulted in unexpected # of rebuilds');

        assert.sameMembers(s.data, [RECORDS[0], RECORDS[1], updatedRecord, RECORDS[3], addedRecord]);
        assert.equal(s.getSync(1), RECORDS[0]);
        assert.equal(s.getSync(2), RECORDS[1]);
        assert.equal(s.getSync(3), updatedRecord);
        assert.equal(s.getSync(4), RECORDS[3]);
        assert.equal(s.getSync(5), addedRecord);

        assert.deepEqual(s.byName, {
          ALAN: RECORDS[0],
          BETH: RECORDS[1],
          DEBRA: RECORDS[3],
          FRANKIE: updatedRecord,
          ERIC: addedRecord
        }, 'reindexed Name');

        assert.sameMembers(s.byGender.M, [RECORDS[0], addedRecord]);
        assert.deepEqual(s.byGender.F, [RECORDS[1], RECORDS[3], updatedRecord]);

        assert.deepEqual(s.byCountry, {
          USA: [RECORDS[1], RECORDS[0]], // reverse sorted
          CANADA: [updatedRecord],
          MEXICO: [RECORDS[3]],
          GERMANY: [addedRecord]
        });

        assert.ok(timesRebuilt > 0, 'rebuilt should have been fired for one or more indices');
      });

      test.test('reindex occurs before external event', function () {
        var s = new TestMemory({data: [RECORDS[0]]});

        var deferred = new Deferred();
        s.on('add', function () {
          // store should have been reindexed
          try {
            assert.deepEqual(s.byName, {
              ALAN: RECORDS[0],
              ERIC: record
            });
            deferred.resolve();
          } catch (e) {
            deferred.reject(e);
          }
        });

        var record = {
          PID: 5,
          Info: { Name: 'Eric' },
          Gender: 'M',
          Country: 'Germany'
        };

        s.addSync(record);

        return deferred;
      });

      test.test('filtering', function () {
        var s = new TestMemory({data: _.clone(RECORDS)});
        var m = s.filter({Gender: 'M'})
        assert.sameMembers(s.fetchSync(), RECORDS);
        assert.sameMembers(m.fetchSync(), [RECORDS[0], RECORDS[2]]);
        assert.sameMembers(s.getByGender('F'), [RECORDS[1], RECORDS[3]]);
        assert.sameMembers(m.getByGender('F'), []);
        var record = {
          PID: 5,
          Info: { Name: 'Eric' },
          Gender: 'M',
          Country: 'Germany'
        };
        s.add(record)
        assert.sameMembers(s.fetchSync(), RECORDS.concat([record]));
        assert.sameMembers(m.fetchSync(), [RECORDS[0], RECORDS[2], record]);
        assert.sameMembers(s.getByGender('F'), [RECORDS[1], RECORDS[3]]);
        assert.sameMembers(m.getByGender('F'), []);
      });
    });
  });
});
