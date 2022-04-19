import Consts from "../Consts";
import * as adal from 'adal-node';
import { AuthenticationContext } from 'adal-node';
import * as vscode from 'vscode';

export default class MSGraphTokenHelper {

    public static acquireToken(tenantId: string): Thenable<adal.TokenResponse> {

        let yourTenantReplaced: string = "";
        // Replace the samples yourtenant with the default tenant name
        if (tenantId.toLowerCase().indexOf(Consts.SamplesYourTenant) >= 0 && MSGraphTokenHelper.getMSGraphDefaultTenantID() != "") {
            tenantId = tenantId.toLowerCase().replace(Consts.SamplesYourTenant, MSGraphTokenHelper.getMSGraphDefaultTenantID() + Consts.TenantRegion)
            yourTenantReplaced = "The policy '" + Consts.SamplesYourTenant + "' tenant name has been replaced with " + MSGraphTokenHelper.getMSGraphDefaultTenantID() + Consts.TenantRegion;
        }

        let clientID = MSGraphTokenHelper.getMSGraphClientID();
        let authURL = Consts.ADALauthURLPrefix + tenantId;
        let authcontext = new adal.AuthenticationContext(authURL);

        return new Promise((resolve, reject) => {
            authcontext.acquireToken(Consts.ADALresource, "", clientID, function (err, tokenResponse) {
                //reauthenticate if the access token is invalid
                if (err) {
                    MSGraphTokenHelper.deviceCodeLogin(tenantId, yourTenantReplaced, clientID)
                        .then(
                            tokenResponse => resolve(tokenResponse),
                            err => reject(err));
                }
                else {
                    resolve(tokenResponse as adal.TokenResponse);
                }
            });
        })
    }

    static deviceCodeLogin(tenantId: string, yourTenantReplaced: string, ClientId: string): Thenable<adal.TokenResponse> {
        var authorityUrl = Consts.ADALauthURLPrefix + tenantId;
        var resource = Consts.ADALresource;
        var context = new AuthenticationContext(authorityUrl);

        return new Promise((resolve, reject) => context.acquireUserCode(resource, ClientId, 'es-mx',
            function (err, response) {
                if (err) {

                    if (yourTenantReplaced) {
                        vscode.window.showWarningMessage(yourTenantReplaced)
                    }

                    console.log('well that didn\'t work: ' + err.message);
                    if (err.message == "Error login in - The clientId parameter is required.") {
                        vscode.window.showErrorMessage("The Graph API ClientId has not been set in Settings.");
                    }
                    else if (err.message.indexOf("AADSTS700016") >= 0 && tenantId.indexOf(Consts.SamplesYourTenant) >= 0)
                        vscode.window.showErrorMessage("Your policy uses '" + Consts.SamplesYourTenant + "' tenant name. Replace the yourtenant with your tenant name. Or configure the 'aadb2c.graph.replaceSamplesYourTenantWith' with your tenant name.");
                    else if (err.message.indexOf("AADSTS700016") >= 0)
                        vscode.window.showErrorMessage("Application with identifier '" + ClientId + " ' was not found in the directory '" + tenantId + "'. You may have sent your authentication request to the wrong tenant. Or the application has not been installed by the administrator of the tenant or consented to by any user in the tenant.");
                    else if (err.message.indexOf("AADSTS90002") >= 0) +
                        vscode.window.showErrorMessage("Tenant '" + tenantId + " ' not found.");
                    else {
                        vscode.window.showErrorMessage(err.message);
                    }
                    reject(err);
                } else {
                    console.log(response.userCode);
                    var usercode = response.userCode;
                    var ncp = require("copy-paste");
                    ncp.copy(usercode, function () {
                        // complete...
                    })

                    vscode.window.showErrorMessage("Please login to '" + tenantId + " ' tenant with the following code (" + response.userCode + ")", "Login").then(selection => {
                        if (selection == "Login") {
                            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(Consts.ADALauthURLDeviceLogin));
                        }
                    });

                    console.log('calling acquire token with device code');

                    context.acquireTokenWithDeviceCode(resource, ClientId, response, function (Error, tokenResponse) {
                        if (err) {
                            console.log('error happens when acquiring token with device code');
                            console.log(err);

                            vscode.window.showErrorMessage('An error happens when acquiring token with device code');
                            reject(err);
                        }
                        else {
                            resolve(tokenResponse as adal.TokenResponse);
                        }
                    });
                }
            }));
    }

    static getMSGraphClientID() {
        var config = vscode.workspace.getConfiguration('aadb2c.graph');

        var RtnVal = config.has("clientid");
        if (!RtnVal) {
            vscode.window.showErrorMessage("The ClientId setting is not set");
            return "";
        }
        return "" + config.get("clientid");
    }

    static getMSGraphDefaultTenantID() {
        var config = vscode.workspace.getConfiguration('aadb2c.graph');

        var RtnVal = config.has("replaceSamplesYourTenantWith");
        if (!RtnVal) {
            return "";
        }

        return "" + config.get("replaceSamplesYourTenantWith");
    }
}