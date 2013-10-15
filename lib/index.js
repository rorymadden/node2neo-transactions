'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var setMaxListeners = EventEmitter.prototype.setMaxListeners;
var Neo4jError = require('./error');

var Q = require('q');


function Transaction (db){

  this.db = db;
  // store the transaction id
  this._commit = undefined;
  // store the statements in case of an error
  this._statements = [];
  this._appliedStatements = [];
  // store the events which need to be issued
  this._events = [];

  EventEmitter.call(this);
  setMaxListeners.call(this, 0);
}
util.inherits(Transaction, EventEmitter);


/**
 * Begin a transaction. This forces all existing statements to be performed and a transaction to be created
 *  var db = require('node2neo')()
 *  var transaction = new Transaction(db);
 *
 *  var statement = [{
 *    statement: 'CREATE (bike:Bike {name:"Cannondale", model:"Synapse"}) RETURN id(bike), bike'
 *  }, {
 *    statement: 'CREATE (bike:Bike {model:"Madone",name:"Trek"}) RETURN id(bike), bike'
 *  }];
 *
 * transaction.begin(statement, function(err, response){
 * })
 *
 * The format of the returned array is as follows:
 *  [{
 *     "columns":["id(bike)","bike"],
 *     "data":[{
 *       "row":[ 10, {"name":"Cannondale", "model":"Synapse"} ]
 *     }]
 *   }, {
 *     "columns":["id(bike)","bike"],
 *     "data":[{
 *       "row":[ 11, {"model":"Madone","name":"Trek"}]
 *     }]
 *   }]
 *
 * @param  {String|Object}   statement A Cypher String or an object with a statement parameter and optional parameter
 * @param  {Object}   options   Optional options. Examples include {commit:true}
 * @param  {Function} callback
 * @return {Object}             The neo4j results array is returned.
 */
Transaction.prototype.begin = function(statement, options, callback){
  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  if(typeof statement === 'function'){
    callback = statement;
    statement = undefined;
    options = {};
  }

  var deferred = Q.defer();

  if(this._commit){
    deferred.reject(new Neo4jError('Existing Open Transaction: '+ this._commit));
    // return callback(new Neo4jError('Existing Open Transaction: '+ this._commit));
  }

  // merge the new statement with any existing statements
  if(statement) {
    if(typeof statement === 'string'){
      this._statements.push({
        statement: statement,
        commandId: this._statements.length
      });
    }
    // if a single object is provided with a statement
    else if(typeof statement === 'object' && statement.statement){
      this._statements.push(statement);
    }
    else if(typeof statement === 'object' && Array.isArray(statement)){
      this._statements = this._statements.concat(statement);
    }
    else {
      deferred.reject(new Neo4jError('Begin transaction: Invalid statement syntax'));
      // return callback(new Neo4jError('Begin transaction: Invalid statement syntax'));
    }
  }


  var self = this;

  this.db.beginTransaction({statements: this._statements}, options, function(err, response){
    if(err) deferred.reject(err);
    else {
      if(response.errors.length > 0){
        deferred.reject(response.errors);
      }
      else {
        if(options.commit){
          // process events
          self._events.forEach(function(element, index, array){
            element.eventEmitter.emit.apply(element.eventEmitter, element.args);
          });

          self._events = [];
          self._statements = [];
          self._appliedStatements = [];
          self._commit = undefined;
        }
        else {
          self._appliedStatements = self._statements;
          self._statements = [];

          // response does not yet exist when using promises so this is not working
          // TODO: investigate how to do this with promises
          self._commit = response.commit;
        }

        deferred.resolve(response.results);
      }
      //   deferred.resolve(Q.fcall(function(response){
      //     if(options.commit){
      //       // process events
      //       for(var action in self._events){
      //         for(var i = 0, len = self._events[action].length; i< len; i++){
      //           if(Array.isArray(self._events[action][i])){
      //             self.emit.apply(self, self._events[action][i]);
      //           }
      //           else self.emit(action, self._events[action][i]);
      //         }
      //       }
      //       self._events = {};
      //       self._pendingStatements = [];
      //       self._commit = undefined;
      //     }
      //     else {
      //       self._pendingStatements = self._statements;
      //       self._commit = response.commit;
      //     }
      //     // empty the statements as they have been applied
      //     self._statements = [];

      //     return response.results;

      //   }));
      // }
    }
  });
  return deferred.promise.nodeify(callback);
};


/**
 * Execute a transaction. This forces all existing statements to be performed on the open transaction
 *
 *
 * @param  {String|Object}   statement A Cypher String or an object with a statement parameter and optional parameter
 * @param  {Function} callback
 * @return {Object}             The neo4j results array is returned.
 */
Transaction.prototype.exec = function(statement, callback){
  if(typeof statement === 'function'){
    callback = statement;
    statement = undefined;
  }

  var deferred = Q.defer();

  if(!this._commit){
    deferred.reject(new Neo4jError('This Transaction is not open. You must start with a begin statement.'));
    // return callback(new Neo4jError('Existing Open Transaction: '+ this._commit));
  }

  // merge the new statement with any existing statements
  if(statement) {
    if(typeof statement === 'string'){
      this._statements.push({
        statement: statement,
        commandId: this._statements.length
      });
    }
    // if a single object is provided with a statement
    else if(typeof statement === 'object' && statement.statement){
      this._statements.push(statement);
    }
    else if(typeof statement === 'object' && Array.isArray(statement)){
      this._statements = this._statements.concat(statement);
    }
    else {
      deferred.reject(new Neo4jError('Begin transaction: Invalid statement syntax'));
      // return callback(new Neo4jError('Begin transaction: Invalid statement syntax'));
    }
  }


  var self = this;

  this.db.executeStatement(self._commit, {statements: this._statements}, function(err, response){
    if(err) deferred.reject(err);
    else {
      if(response.errors.length > 0){
        deferred.reject(response.errors);
      }
      else {
        // move the statements to applied
        self._appliedStatements = self._statements;
        self._statements = [];

        deferred.resolve(response.results);
      }
    }
  });
  return deferred.promise.nodeify(callback);
};



/**
 * Commit a transaction. This forces all existing transactions to be performed and the transaction to be closed
 *
 *  var statement = [{
 *    statement: 'CREATE (bike:Bike {name:"Cannondale", model:"Synapse"}) RETURN id(bike), bike'
 *  }, {
 *    statement: 'CREATE (bike:Bike {model:"Madone",name:"Trek"}) RETURN id(bike), bike'
 *  }];
 *
 * User.commit(statement, function(err, response){
 * })
 *
 * The format of the returned array is as follows:
 *  [{
 *     "columns":["id(bike)","bike"],
 *     "data":[{
 *       "row":[ 10, {"name":"Cannondale", "model":"Synapse"} ]
 *     }]
 *   }, {
 *     "columns":["id(bike)","bike"],
 *     "data":[{
 *       "row":[ 11, {"model":"Madone","name":"Trek"}]
 *     }]
 *   }]
 *
 * @param  {String|Object}   statement Optional: A Cypher String or an object with a statement parameter and optional parameter
 * @param  {Function} callback
 * @return {Object}             The neo4j results array is returned.
 */
Transaction.prototype.commit = function(statement, callback){
  if(typeof statement === 'function'){
    callback = statement;
    statement = undefined;
  }

  // merge the new statement with any existing statements
  if(statement) {
    if(typeof statement === 'string'){
      this._statements.push({
        statement: statement,
        commandId: this._statements.length
      });
    }
    else if(typeof statement === 'object' && statement.statement){
      this._statements.push(statement);
    }
    else if(typeof statement === 'object' && Array.isArray(statement)){
      this._statements = this._statements.concat(statement);
    }
    else {
      deferred.reject(new Neo4jError('Commit transaction: Invalid statement syntax'));
      // return callback(new Neo4jError('Begin transaction: Invalid statement syntax'));
    }
  }

  var deferred = Q.defer();
  var self = this;

  if(this._commit){
    this.db.commitTransaction(this._commit, {statements: this._statements}, function(err, response){
      if(err) deferred.reject(err);
      else {
        if(response.errors.length > 0){
          deferred.reject(response.errors);
        }
        else {
          // deferred.resolve(Q.fCall(function(response){
          //   // empty the statements as they have been applied
          //   self._pendingStatements = [];
          //   self._statements = [];

          //   // process events
          //   for(var action in self._events){
          //     for(var i = 0, len = self._events[action].length; i< len; i++){
          //       if(Array.isArray(self._events[action][i])){
          //         self.emit.apply(self, self._events[action][i]);
          //       }
          //       else self.emit(action, self._events[action][i]);
          //     }
          //   }
          //   self._events = {};

          //   // response does not yet exist when using promises so this is not working
          //   // TODO: investigate how to do this
          //   self._commit = undefined;
          //   return response.results;
          // }));
          // empty the statements as they have been applied
          self._statements = [];
          self._appliedStatements = [];

          // process events
          self._events.forEach(function(element, index, array){
            element.eventEmitter.emit.apply(element.eventEmitter, element.args);
          });

          self._events = [];

          // response does not yet exist when using promises so this is not working
          // TODO: investigate how to do this
          self._commit = undefined;
          deferred.resolve(response.results);
        }
      }
    });
  }
  else {
    return self.begin(statement, {commit:true}, callback);
  }
  return deferred.promise.nodeify(callback);
};



/**
 * Remove a transaction. This reverts all statements that have already been applied
 *
 * @param  {Function} callback
 * @return {Null}
 */
Transaction.prototype.remove = function(callback){
  // var deferred = Q.defer();


  if(typeof this._commit === 'undefined'){
    // deferred.reject(new Neo4jError('This Transaction is not open. There is nothing to remove.'));
    return callback(new Neo4jError('This Transaction is not open. There is nothing to remove.'));
  }

  var self = this;

  this.db.removeTransaction(this._commit, function(err){
    if(err) return callback(err);
    else {
      // move the statements to applied
      self._appliedStatements = [];
      self._statements = [];
      self._events = [];
      self._commit = undefined;

      return callback(null);
      // deferred.resolve(null);
    }
  });
  // return deferred.promise.nodeify(callback);
};

module.exports = Transaction;