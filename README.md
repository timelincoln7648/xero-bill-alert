# Bill Alert Readme


## About
This is a sample app created by [Xero - "Beautiful Business"](https://xero.com). This app allows users to register with just a phone number, using Twilio to send texts to verify the phone number and register the user. The app allows users to connect their Xero account after which the app pulls down info of all unpaid bills. The app will send a reminder text to the user near the day the bill is due, with a deep link to view and pay the bill back in Xero. The app will also send an instant notification to the user when a bill is created in Xero for an amount over the user defined threshold. The app uses Xero Webhooks to keep the database of bills consistent (no periodic checks of the API!). The app also uses webhooks to faciliate the instant notification. 

### Xero
Xero is a cloud platform used by over 1.4 million small businesses worldwide for general accounting, payroll, cashflow, inventory and much, much more. Xero has robust API's used by over 600 certified connected apps in the [Xero App Marketplace](https://www.xero.com/marketplace/). You can use this app however you like, but it's a great example for learning how to work with the Xero API and it's new webhooks feature. Refer to Xero's [Developer Centre](https://developer.xero.com/) for full documentation, developer forums, SDK's, how-to guides and much more. 

## Pre Reqs

### Twilio
This app uses Twilio for notifications. You can easily replace the code to use Twilio with a notifcation service of your choice (i.e. slack messages, email, etc). See Twilio's [docs](https://www.twilio.com/docs/) for setting up a messaging service to use with this sample app.

### Xero
This app has a strong primary dependency on the Xero API and it's new Webhooks feature. To use the API you'll need to register a Xero account and login to [developer.xero.com](developer.xero.com) and set up an app. 

### AWS
This app uses AWS Dynamo DB and the [aws-sdk for node](https://aws.amazon.com/sdk-for-node-js/). 

### Express
This app uses [express](https://www.npmjs.com/package/express) and [express-session](https://www.npmjs.com/package/express-session) for running the server and user sessions.


## Get Started
### To get started with this sample app, complete the following steps:

1. Download the app code

	 Clone the repo - https://github.com/XeroAPI/bill-alert

2. cd into the project directory 

3. Type “npm install” to install the node modules necessary for the app Config

4. Type touch .env, then open .env, then add your twilio credentials like the below example. The NPM module dotenv will pull these values from the .env automatically and load them into twilioConfig.js for you. 

    TWILIO_ACCOUNT_SID = 'REPLACE_ME'
    
    TWILIO_AUTH_TOKEN = 'REPLACE_ME'
    
    NOTIFY_SERVICE_SID = 'REPLACE_ME'

5. Get your Xero config details from developer.xero.com -> My Apps and fill in the config.json file with the correct consumer key and secret. Remember to set the webhook key and Xero OAuth callback URL according to your server root URL as well. 

6. Add your Xero privateKey.pem to your project directory 
(only private and partner apps use a private key.) 
see [these instructions](https://developer.xero.com/documentation/auth-and-limits/partner-applications). 

7. Add your AWS credentials

	Find your credentials following [these instructions](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-your-credentials.html)

	Save your credentials to your machine following [these instructions](https://aws.amazon.com/sdk-for-node-js/)


## Webhooks

You’ll need to setup webhooks in My Apps on developer.xero.com. See [creating webhooks](https://developer.xero.com/documentation/webhooks/creating-webhooks).

Use ngrok or other tool to test on localhost.
Remember to set your webhook key in config.json and set your webhook URL in developer.xero.com -> My Apps -> Webhooks

## AWS Dynamo DB

If you choose to use Dynamo DB like this sample app does, you will need to manually create your users table before running the app. Make a table called “users” with primary partition key “phoneNumber” (no need to set a sort key, and the performance settings are up to you although you should be fine with the lowest performance settings) and if you want to enable encryption at rest like we have, see [these instructions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.tutorial.html#encryption.tutorial-console) for enabling that when you set up your table.



## Launch App

Set app.listen to your server of choice (probably localhost)

You’re ready! - Hit “node app.js”



## Caveats

#### Beware
This app is meant to demonstrate concepts and help developers understand how to use the tools therein, such as the Xero API, webhooks, Dynamo DB, etc. It is not recommended to be re-used as a production app as it has not been robustely tested. 

#### Data use
Whenever users grant you the right to their data, especially their business data, you have a responsibility to care for and protect it. If you do right by your users, they will reward you with their trust and their business.

##### Thanks for reading and have fun!
