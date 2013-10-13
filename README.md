# Node2Neo

Transasction wrapper for Node2Neo queries
Transactions allow the creation of multiple Node2Neo transactions. Transactions store cypher statements in case of an error and store events to be triggered once the transaction has been successfully committed.

Transactions are useful when you have multiple separate items to create but want an "all-or-nothing" commital approach in the database. For example event nodes are a good way of tracking changes to a node over time. Every change that is created you create a new event node and link it via a relationship to the updated node. In this instance you have to update the original node, create a new event node, create a relationship between teh two, update other existing relationships and potentially more. Transactions are useful in this and other use cases.

#### Transaction.begin

```js
var db = require('node2neo')('http://localhost:7474')
var Transaction = require('node2neo-transaction');

var trans1 = new Transaction(db);

trans1.begin([statement], function(err, response){
  //execute transactions
})

```

[statement] is optional and can be a cypher string or an object with 'statement' and 'parameters' properties.
See the node2neo-model repository for transaction options.

#### Transaction Execution
After opening a transasction you can execute a number of statements on the transaction. These will all run and return an error or the results of the transaction. You can nest transactions,  if you need the previous new node id, for example.

Using the async library is useful for running multiple items in sync or parallel.

Once all of the transactions have been applied you can commit the transaction to the database.

```js
trans1.begin(function(err, response){
  if(err) return callback(err)
  async.parallel([
    function(cb){
      User.create(userData, {transaction: trans1}, function(err, response){
        if(err) return cb(err);
        var relationship = {
          indexKey: '_id',
          indexValue: response._id, //The id of the node you are interested in.
          nodeLabel: 'User',
          direction: 'from',
          type: 'FRIEND'
        }
        Event.create(eventData, {relationship: relationship, transaction: trans1}, cb);
      });
    },
    function(cb){
      Other.create...
    }],
    function(err, results){
      if(err) return callback(err);
      trans1.commit(function(err, results){
        if(err) return callback(err);
        // do something...
        //all of the statements will have been executed correctly or rolled back.
      });
    }
  );
});
```

#### Transaction Commit
After you have opened a transaction and have applied all of the statements you can commit the transaction.

```js
trans1.commit(function(err, response){
  // if any of the statements have produced an error they will be returned here.
  if(err) return callback(err);
  //do something...
});
```

#### Transaction Removal
Transactions automatically expire after a period of time. If you want to remove a transaction before this time you can explicitly remove it.


```js
trans1.remove(function(err){
  return callback(err)
})
```

##Licence
MIT