var twilio = require('./twilio'),
    dynamo = require('./dynamo'),
    schedule = require('node-schedule'),
    dateFormat = require('dateformat'),
    currency = require('currency-formatter');
    
const phoneNumber = '3615373072';

//public functions

module.exports = {
  
    start: function () {
        
        // test run every 15 seconds
        var dailyJob = schedule.scheduleJob('15 * * * * *', function() {
            const today = Date.now();
            console.log("Scheduled Daily Job Fired");
            
            (async () => {
            
                await dynamo.getAllXeroConnectedUsers().then(
                  function(data) {
                    // console.log("Here are the items retrieved from the scan:\n", data);
                    
                    data.Items.forEach(function(item) {
                        
                        (async () => {
                            await dynamo.getUser(item.phoneNumber).then(
                                function(user) {
                                    console.log("\n"+user.Item.orgName+" has the following unpaid bills: ");
                                    user.Item.invoices.forEach(function(invoice){
                                        const dueDate = Date.parse(invoice.DueDateString);
                                        const dateDiffInDays = Math.abs((today - dueDate)/(1000 * 60 * 60 * 24));     //divide by milliseconds in a day
                                        
                                        
                                        if ((invoice.AmountDue > 0) && (dateDiffInDays < 3)) {
                                            //work with data
                                            console.log("\nInvoiceID: ", invoice.InvoiceID);
                                            console.log("Date diff: ", dateDiffInDays);
                                            console.log("Due: ", dateFormat(dueDate, "longDate"));
                                            console.log("Amount Due: ", invoice.AmountDue);
                                            
                                            //send text
                                            var text = makeTextMessageString(user.Item.orgName, invoice.InvoiceID, invoice.AmountDue, dueDate);
                                            console.log(text);
                                            twilio.sendText(item.phoneNumber, text);
                                            
                                        }
                                    });
                                }
                            ).catch(function(error) {
                                console.log("Error finding user: ", error);
                            });
                        
                        })();
                        
                    });
                    
                    
                    
                  }
                ).catch(function(error) {
                    console.log("Error running scan: ", error);
                });
            
            })();
            
            
        });
        
        //todo
        //get users
        //FOR EACH
            //work with data
            //make text with deep link(s)
            //send text
        
    },
    
    //other functions to export
  

};

function makeTextMessageString(orgName, invoiceID, amount, dueDate) {
    var shortCode = "!f1qT8";
    var deepLink = "https://go.xero.com/organisationlogin/default.aspx?shortcode="+shortCode+"&redirecturl=/AccountsPayable/Edit.aspx?InvoiceID="+invoiceID;
    var textString = orgName+" has a bill for "+currency.format(amount, { code: 'USD' })+", due on "+dateFormat(dueDate, "longDate")+".";
    textString += "\n\nClick below to view and pay this bill in Xero. \n";
    textString += deepLink;
    
    return textString;
}

function getUser (phoneNumber) {
    dynamo.getUser(phoneNumber).then(
          function(data) {
            console.log("got user here's the details:\n", data.Item.orgName);
          }
        ).catch(function(error) {
            console.log(error);
        });
}

// Scheduled at 8:30 am each morning
// var dailyJob = schedule.scheduleJob('30 8 * * *', function() {
//     console.log("Scheduled Daily Job Fired")
    
//     //TODO get user bills from DB
//     //check over for due date that matches today
//     //IF you have bills that are due today!! 
//         //build text message string with deep link
//         //twilio send text to userPhoneNumber 
    
// })


//private functions