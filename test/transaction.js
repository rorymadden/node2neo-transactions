var testDatabase = require('./util/database');
var db = require('node2neo')(testDatabase.url);
var Transaction = require('../');
var EventEmitter = require('events').EventEmitter;

var should = require('chai').should();
var sinon = require('sinon');
var assert = require('assert');



var transaction, User, rootUserId, userData;


describe("transaction", function(){
  it("should begin a transaction", function(done){
    var trans1 = new Transaction(db);
    trans1.begin(function(err, response){
      should.exist(trans1._commit);
      trans1._statements.should.be.an('array').with.length(0);
      trans1.commit(function(err2, response2){
        //test the begin
        should.not.exist(err);
        should.exist(response);
        response.length.should.be.equal(0);

        //test the commit
        should.not.exist(err2);
        should.not.exist(trans1._commit);
        trans1._statements.should.be.an('array').with.length(0);
        should.exist(response2);
        response2.length.should.be.equal(0);
        done();
      });
    });
  });
  it("should begin a Transaction: with string statement", function(done){
    var statement = 'CREATE n:User RETURN id(n)';
    var trans2 = new Transaction(db);
    trans2.begin(statement, function(err, response){
      should.exist(trans2._commit);
      trans2._appliedStatements.should.be.an('array').with.length(1);
      trans2.commit(function(err2, response2){
        //test teh begin
        should.not.exist(err);
        should.exist(response);
        response.length.should.be.equal(1);
        response[0].columns[0].should.be.equal('id(n)');
        response[0].data[0].row[0].should.be.a('number');

        //test the commit
        should.not.exist(err2);
        should.not.exist(trans2._commit);
        trans2._statements.should.be.an('array').with.length(0);
        should.exist(response2);
        response2.length.should.be.equal(0);
        done();
      });
    });
  });
  it("should begin a Transaction: with object statement", function(done){
    var statement = {
      statement: 'CREATE n:User RETURN id(n)'
    };
    var trans3 = new Transaction(db);
    trans3.begin(statement, function(err, response){
      should.exist(trans3._commit);
      trans3._appliedStatements.should.be.an('array').with.length(1);
      trans3.commit(function(err2, response2){
        // test the begin
        should.not.exist(err);
        should.exist(response);
        response.length.should.be.equal(1);
        response[0].columns[0].should.be.equal('id(n)');
        response[0].data[0].row[0].should.be.a('number');

        //test the commit
        should.not.exist(err2);
        should.not.exist(trans3._commit);
        trans3._statements.should.be.an('array').with.length(0);
        should.exist(response2);
        response2.length.should.be.equal(0);
        done();
      });
    });
  });
  it("should fail to begin a transaction with invalid statement", function(done){
    var statement = {
      statement: 'blue'
    };
    var trans3 = new Transaction(db);
    trans3.begin(statement, function(err, response){
      should.exist(err);
      err[0].message.should.contain('Invalid input');
      should.not.exist(trans3._commit);
      done();
    });
  });
  it("should error if you try to open the same transaction twice", function(done){
    var trans = new Transaction(db);
    trans.begin(function(err, response){
      should.not.exist(err);
      trans.begin(function(err, response){
        should.exist(err);
        err.message.should.contain('Existing Open Transaction:');
        done();
      });
    });
  });
  it("should not error if trying to open a second transaction", function(done){
    var trans4 = new Transaction(db);
    var trans5 = new Transaction(db);
    trans4.begin(function(err, response){
      should.not.exist(err);
      trans5.begin(function(err, response){
        should.not.exist(err);
        trans4.remove(function(err){
          should.not.exist(err);
          trans5.remove(function(err){
            should.not.exist(err);
            done();
          });
        });
      });
    });
  });
  it("should commit with string statement", function(done){
    var statement = 'CREATE n:User RETURN id(n)';
    var trans1 = new Transaction(db);
    trans1.begin(function(err, response){
      should.exist(trans1._commit);
      trans1._statements.should.be.an('array').with.length(0);
      trans1.commit(statement, function(err2, response2){
        //test the begin
        should.not.exist(err);
        should.exist(response);
        response.length.should.be.equal(0);

        //test the commit
        should.not.exist(err2);
        should.not.exist(trans1._commit);
        trans1._statements.should.be.an('array').with.length(0);
        should.exist(response2);
        response2.length.should.be.equal(1);
        done();
      });
    });
  });
  it("should commit with object statement", function(done){
    var statement = {
      statement: 'CREATE n:User RETURN id(n)'
    };
    var trans1 = new Transaction(db);
    trans1.begin(function(err, response){
      should.exist(trans1._commit);
      trans1._statements.should.be.an('array').with.length(0);
      trans1.commit(statement, function(err2, response2){
        //test the begin
        should.not.exist(err);
        should.exist(response);
        response.length.should.be.equal(0);

        //test the commit
        should.not.exist(err2);
        should.not.exist(trans1._commit);
        trans1._statements.should.be.an('array').with.length(0);
        should.exist(response2);
        response2.length.should.be.equal(1);
        done();
      });
    });
  });
  it("should commit with object statement", function(done){
    var statement = {
      statement: 'blue'
    };
    var trans1 = new Transaction(db);
    trans1.begin(function(err, response){
      should.exist(trans1._commit);
      trans1._statements.should.be.an('array').with.length(0);
      trans1.commit(statement, function(err2, response2){
        //test the begin
        should.exist(err2);
        err2[0].message.should.contain('Invalid input');
        done();
      });
    });
  });
  it("should fail on removal of non-open transaction", function(done){
    var trans = new Transaction(db);
    trans.remove(function(err){
      should.exist(err);
      err.message.should.equal('This Transaction is not open. There is nothing to remove.');
      done();
    });
  });
  it("should execute a statement on an open transaction", function(done){
    var trans = new Transaction(db);
    trans.begin(function(err){
      should.not.exist(err);
      trans.exec('Create n:User RETURN id(n)', function(err, result){
        should.not.exist(err);
        result[0].data[0].row[0].should.be.a('number');
        trans.commit(function(err){
          should.not.exist(err);
          done();
        });
      });
    });
  });
  it("should emit events: begin", function(done){
    var trans = new Transaction(db);
    var eventEmit = new EventEmitter();
    trans._events.push({
      eventEmitter: eventEmit,
      args: ['test', {name: 'Test'}, {second: 'Test'}]
    });
    var eventSpy = sinon.spy();
    eventEmit.on('test', eventSpy);

    trans.begin('Create n RETURN n', {commit: true}, function(err, response){
      should.not.exist(err);
      assert(eventSpy.called, 'Event did not fire.');
      assert(eventSpy.calledOnce, 'Event fired more than once');
      eventSpy.alwaysCalledWithExactly({name: 'Test'}, {second: 'Test'}).should.equal(true);
      done();
    });
  });
  it("should emit events: commit", function(done){
    var trans = new Transaction(db);
    var eventEmit = new EventEmitter();
    trans._events.push({
      eventEmitter: eventEmit,
      args: ['test2', {name: 'Test'}, {second: 'Test'}]
    });
    var eventSpy = sinon.spy();
    eventEmit.on('test2', eventSpy);

    trans.begin(function(err){
      should.not.exist(err);
      trans.commit(function(err, response){
        should.not.exist(err);
        assert(eventSpy.called, 'Event did not fire.');
        assert(eventSpy.calledOnce, 'Event fired more than once');
        eventSpy.alwaysCalledWithExactly({name: 'Test'}, {second: 'Test'}).should.equal(true);
        done();
      });
    });
  });
});