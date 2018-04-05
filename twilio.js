//setup
require('dotenv').config()

//twilio
var twilioConfig = require('./twilioConfig.js');
const client = require('twilio')(twilioConfig.ACCOUNT_SID, twilioConfig.AUTH_TOKEN);


//public functions

module.exports = {
  
    sendText: function (phoneNumber, textBody) {
    const notificationOpts = {
      toBinding: JSON.stringify({
        binding_type: 'sms',
        address: '+1'+phoneNumber,
      }),
      body: textBody,
    };
    
    client.notify
      .services(twilioConfig.NOTIFY_SERVICE_SID)
      .notifications.create(notificationOpts)
      .then(notification => console.log("Sent notification, SID: ", notification.sid))
      .catch(error => console.log(error));
    },
    
    //other functions to export
  

};


//private functions
