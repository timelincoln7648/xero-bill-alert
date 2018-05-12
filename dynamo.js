const randomInt = require('random-int');
const uuid = require('uuid/v1');
var AWS = require('aws-sdk');

// Set the region 
AWS.config.update({region: 'us-east-2'});

//create the docClient
var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

//public functions

module.exports = {
  
  
    getUser: function (phoneNumber) {
      var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            }
        };
        //return promise object for async and success/failure handling in main app.js
      return docClient.get(params).promise();
    },
    
    getAllXeroConnectedUsers: function () {
        var params = {
            TableName: "users",
            FilterExpression: "attribute_exists(orgName)"
        };
        
        return docClient.scan(params).promise();
    },

    getUserForOrgId: function (orgId) {
        var params = {
            TableName: "users",
            FilterExpression: "orgID = :val",
            ExpressionAttributeValues: {":val": orgId}
        };
        
        return docClient.scan(params).promise();
    },
    
    createUser: function (phoneNumber) {
        //add attributes to item
        var params = {
          TableName: 'users',
          Item: {
            'phoneNumber': phoneNumber
          }
        };
        
        return docClient.put(params).promise();
    },
    
    updateUserXeroAccessToken: function (phoneNumber, xeroAccessToken) {
        
        var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            },
        UpdateExpression: "set xeroAccessToken = :xeroAccessToken",
            ExpressionAttributeValues: {
                ":xeroAccessToken": xeroAccessToken
            },
            ReturnValues:"UPDATED_NEW"
        };
        
        //return promise object for async and success/failure handling in main app.js
        return docClient.update(params).promise();
    },
    
    updateUserOrgDetails: function (phoneNumber, orgName, orgShortCode, orgID) {
      var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            },
        UpdateExpression: "set orgName = :orgName, orgShortCode = :orgShortCode, orgID = :orgID",
            ExpressionAttributeValues: {
                ":orgName": orgName,
                ":orgShortCode": orgShortCode,
                ":orgID": orgID
            },
            ReturnValues:"UPDATED_NEW"
        };
        
        //return promise object for async and success/failure handling in main app.js
      return docClient.update(params).promise();
    },
    
    updateUserInvoices: function (phoneNumber, invoices) {
      var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            },
        UpdateExpression: "set invoices = :invoices",
            ExpressionAttributeValues: {
                ":invoices": invoices
            },
            ReturnValues:"UPDATED_NEW"
        };
        
        //return promise object for async and success/failure handling in main app.js
      return docClient.update(params).promise();
    }
    
  
    //old way of getting user details without using promises
    // getUserDetails: function (phoneNumber, onSuccess) {
        
    //     // Create DynamoDB document client
    //     var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
        
    //     var params = {
    //     TableName: "users",
    //     Key: 
    //         {
    //             'phoneNumber': phoneNumber
    //         }
    //     };
        
    //     const data = docClient.get(params, function(err, data) {
    //       if (err) {
    //         console.log("Error getting user: ", err);
    //       } else {
    //         console.log("Success getting user: ", data.Item);
    //         onSuccess(data.Item);
    //       }
    //     });
    // },
    
    
    
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
