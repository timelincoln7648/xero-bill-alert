const randomInt = require('random-int');
const uuid = require('uuid/v1');
var AWS = require('aws-sdk');

// Set the region 
AWS.config.update({region: 'us-east-2'});


//public functions

module.exports = {
  
  
    getUser: function (phoneNumber) {
      var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
      var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            }
        };
      return docClient.get(params).promise();
    },
  
    getUserDetails: function (phoneNumber, onSuccess) {
        
        // Create DynamoDB document client
        var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
        
        var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            }
        };
        
        const data = docClient.get(params, function(err, data) {
          if (err) {
            console.log("Error getting user: ", err);
          } else {
            console.log("Success getting user: ", data.Item);
            onSuccess(data.Item);
          }
        });
    },
    
    createUser: function (phoneNumber) {
        // Create DynamoDB document client
        var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
       
       
        //add attributes to item
        var params = {
          TableName: 'users',
          Item: {
            'phoneNumber': phoneNumber
          }
        };
        
        //add item to table
        docClient.put(params, function(err, data) {
          if (err) {
            console.log("Error creating new user: ", err);
          } else {
            console.log("Success creating new user: ", data);
          }
        });
    },
    
    // createTable: function () {
    //     // Create the DynamoDB service object
    //     var ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});
        
    //     var params = {
    //       AttributeDefinitions: [
    //         {
    //           AttributeName: 'USER_ID',
    //           AttributeType: 'S'
    //         },
    //         {
    //           AttributeName: 'USER_PHONE',
    //           AttributeType: 'N'
    //         }
    //       ],
    //       KeySchema: [
    //         {
    //           AttributeName: 'USER_ID',
    //           KeyType: 'HASH'
    //         },
    //         {
    //           AttributeName: 'USER_PHONE',
    //           KeyType: 'RANGE'
    //         }
    //       ],
    //       ProvisionedThroughput: {
    //         ReadCapacityUnits: 1,
    //         WriteCapacityUnits: 1
    //       },
    //       TableName: 'BANANA_LIST',
    //       StreamSpecification: {
    //         StreamEnabled: false
    //       },
    //     }
    
        
    //     ddb.createTable(params, function(err, data) {
    //       if (err) {
    //         console.log("Error", err);
    //       } else {
    //         console.log("Table Created", data);
    //       }
    //     });
    // }

};


//private functions
