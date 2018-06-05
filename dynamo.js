const 	randomInt 	= require('random-int');
const 	uuid 		= require('uuid/v1');
var 	AWS 		= require('aws-sdk');

// Set the region if you need to
// AWS.config.update({region: 'eu-west-1'});

//create the docClient
var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});



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
    }, 

    updateUserAmountLimit: function (phoneNumber, amountLimit) {
      var params = {
         TableName: "users",
         Key: 
            {
                'phoneNumber': phoneNumber
            },
        UpdateExpression: "set amountLimit = :amountLimit",
            ExpressionAttributeValues: {
                ":amountLimit": amountLimit
            },
            ReturnValues:"UPDATED_NEW"
        };
        
        //return promise object for async and success/failure handling in main app.js
      return docClient.update(params).promise();
    }

};

