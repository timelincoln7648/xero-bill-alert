const randomInt = require('random-int');
const uuid = require('uuid/v1');
var AWS = require('aws-sdk');

// Set the region 
AWS.config.update({region: 'us-east-2'});


//public functions

module.exports = {
  
    getUserDetails: function (userID, userPhone) {
        
        //example use
        //getUserDetails('a69ab820-32bf-11e8-b17e-07b9652a72cb', 1566267024);
        
        // Create DynamoDB document client
        var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
        
        var params = {
         TableName: "Users",
         Key: 
            {
                'USER_ID': userID,
                'USER_PHONE': userPhone
            }
        };
        
        docClient.get(params, function(err, data) {
          if (err) {
            console.log("Error", err);
          } else {
            console.log("Success", data.Item);
          }
        });
    },
    
    createUser: function () {
        // Create DynamoDB document client
        var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
       
       //create user item
       
       //make UUID and other data
       var newUserID = uuid();
       var newUserPhone = randomInt(1, 9995730989);
       var newUserOrgName = "Joes Donuts";
       console.log("newUserID is: "+newUserID);
       console.log("newUserPhone is: "+newUserPhone);
        
        //add attributes to item
        var params = {
          TableName: 'Users',
          Item: {
            'USER_ID': newUserID,
            'USER_PHONE': newUserPhone,
            'ORG_NAME': newUserOrgName
          }
        };
        
        //add item to table
        docClient.put(params, function(err, data) {
          if (err) {
            console.log("Error", err);
          } else {
            console.log("Success", data);
          }
        });
    },
    
    createTable: function () {
        // Create the DynamoDB service object
        var ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});
        
        var params = {
          AttributeDefinitions: [
            {
              AttributeName: 'USER_ID',
              AttributeType: 'S'
            },
            {
              AttributeName: 'USER_PHONE',
              AttributeType: 'N'
            }
          ],
          KeySchema: [
            {
              AttributeName: 'USER_ID',
              KeyType: 'HASH'
            },
            {
              AttributeName: 'USER_PHONE',
              KeyType: 'RANGE'
            }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
          },
          TableName: 'BANANA_LIST',
          StreamSpecification: {
            StreamEnabled: false
          },
        }
    
        
        ddb.createTable(params, function(err, data) {
          if (err) {
            console.log("Error", err);
          } else {
            console.log("Table Created", data);
          }
        });
    }

};


//private functions
