define([
  'intern!tdd',
  'intern/chai!assert',
  'dojo/_base/declare',
  'indexed-memory'
], function (test, assert, declare, IndexedMemory) {
  var TestMemory = declare(IndexedMemory, {
    idProperty: 'PID',
    indices: [
      { field: 'Name', key: 'Info.Name', keyGen: function (name) { return name.toUpperCase(); }},
      { type: 'group', field: 'Gender', key: 'Gender', sort: 'Info.Name' },
      { type: 'group',
        field: 'Country',
        key: 'Country',
        keyGen: function (country) { return country.toUpperCase(); },
        sort: function (record) { return -record.PID; /* reverse sort by PID */ }
      }
    ]
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

  test.suite('IndexedMemory', function () {
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
      assert.equal(timesRebuilt, 1, 'bulk operation resulted in multiple index rebuilds');

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
      assert.equal(timesRebuilt, 1, 'bulk operation resulted in multiple index rebuilds');

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
    });
  });
});