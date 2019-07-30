// Adding ADAL for Policy Upload
import * as adal from 'adal-node';
import { window } from 'vscode';
import * as vscode from 'vscode';
import Consts from './Consts';
import { AuthenticationContext } from 'adal-node';
import Config from './config';
import * as fs from 'fs';

var xpath = require('xpath');
var DOMParser = require('xmldom').DOMParser;

interface IPolicy {
    policyInfo: PolicyInfoObj,
    xmlData: string,
    uploaded: boolean
}

interface PolicyInfoObj {
    PolicyId: string,
    BasePolicyId: string,
    TenantId: string;
}

export default class B2CUtils {

    static devcodelogin(tenantId: string, ClientId: string): Thenable<adal.TokenResponse> {
        var authorityUrl = Consts.ADALauthURLPrefix + tenantId;
        var resource = 'https://graph.microsoft.com';
        var context = new AuthenticationContext(authorityUrl);

        return new Promise((resolve, reject) => context.acquireUserCode(resource, ClientId, 'es-mx', function (err, response) {
            if (err) {
                console.log('well that didn\'t work: ' + err.message);
                if (err.message = "Error login in - The clientId parameter is required.") {
                    vscode.window.showErrorMessage("The Graph API ClientId has not been set in Settings.");
                }
                else {
                    vscode.window.showErrorMessage("Error login in - " + err.message);
                }
                reject(err);
            } else {
                console.log(response.userCode);
                var usercode = response.userCode;
                var ncp = require("copy-paste");
                ncp.copy(usercode, function () {
                    // complete...
                })

                vscode.window.showErrorMessage("Please login with the following code (" + response.userCode + ")", "Login").then(selection => {
                    if (selection == "Login") {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse("https://www.microsoft.com/devicelogin"));
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

    static acquireToken(tenantId: string): Thenable<adal.TokenResponse> {
        let clientID = B2CUtils.getB2CAPIClientID();
        let authURL = Consts.ADALauthURLPrefix + tenantId;
        let authcontext = new adal.AuthenticationContext(authURL);

        return new Promise((resolve, reject) => {
            authcontext.acquireToken(Consts.ADALresource, "", clientID, function (err, tokenResponse) {
                //reauthenticate if the access token is invalid
                if (err) {
                    B2CUtils.devcodelogin(tenantId, clientID)
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

    static uploadPolicyRegister() {
        var PolicyInfo = B2CUtils.getPolicyInfo();

        this.acquireToken(PolicyInfo.TenantId).then(tokenResponse =>
            B2CUtils.uploadpolicy(tokenResponse as adal.TokenResponse, PolicyInfo.PolicyId));
    }

    static async uploadAllPoliciesRegister() {
        let targetEnvironment = Config.GetDefaultEnvironment();
        let environment = await Config.GetEnvironment(targetEnvironment);
        let tokenResponse = await this.acquireToken(environment.Tenant);

        let files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(`${vscode.workspace.rootPath}/Environments/${targetEnvironment}` as string, '*.{xml}'));

        var policies = this.loadPolicies(files);
        for (const policy of policies) {
            await this.uploadSinglePolicy(tokenResponse, policy[1], policies);
        }
    }

    static async uploadSinglePolicy(tokenResponse: adal.TokenResponse, policy: any, policies: Map<string, IPolicy>) {
        if (policy.uploaded) {
            return;
        }

        // upload base policy first
        if (policy.policyInfo.BasePolicyId) {
            let basePolicy = policies.get(policy.policyInfo.BasePolicyId);
            if (basePolicy && !basePolicy.uploaded) {
                await this.uploadSinglePolicy(tokenResponse, basePolicy, policies);
            }
        }

        var bearertoken = "Bearer " + tokenResponse.accessToken;

        var options2 = {
            method: "PUT",
            url: Consts.B2CGraphEndpoint + "/" + policy.policyInfo.PolicyId + "/$value",
            headers: {
                "Authorization": bearertoken,
                "Content-Type": "application/xml"
            }
        };

        var request = require('request');
        function callback(this: B2CUtils, error, response) {
            if (!error && response.statusCode == 200) {
                console.error("Upload success.")
                vscode.window.showInformationMessage("Upload success")
            }
            else {
                var rspbody = response.body;
                var errmsg = JSON.parse(rspbody).error.message;
                console.error("Upload failed: " + errmsg)
                vscode.window.showErrorMessage(errmsg);
            }
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Policy (" + policy.policyInfo.PolicyId + ")...",
            cancellable: false
        },
            async () => {
                await request(options2, callback.bind(this)).write(policy.xmlData);
                policy.uploaded = true;
            });
    }

    static loadPolicies(files: vscode.Uri[]): Map<string, IPolicy> {
        var result = new Map<string, IPolicy>();
        files.forEach(file => {
            try {
                let xmlData = fs.readFileSync(file.fsPath).toString();
                let xmlDoc = new DOMParser().parseFromString(xmlData);
                let selector = xpath.useNamespaces({ "ns": "http://schemas.microsoft.com/online/cpim/schemas/2013/06" });
                let policyId = selector("./ns:TrustFrameworkPolicy/@PolicyId", xmlDoc)[0].nodeValue;
                let basePolicyId = "";
                if (selector("./ns:TrustFrameworkPolicy/ns:BasePolicy", xmlDoc).length > 0) {
                    basePolicyId = selector("./ns:TrustFrameworkPolicy/ns:BasePolicy/ns:PolicyId", xmlDoc)[0].textContent;
                }
                result.set(policyId, {
                    policyInfo: {
                        TenantId: "",
                        PolicyId: policyId,
                        BasePolicyId: basePolicyId
                    },
                    xmlData: xmlData,
                    uploaded: false
                });
            } catch (error) {
                vscode.window.showErrorMessage("Error retrieving PolicyId and BasePolicyId from Policy File. Please ensure the file being uploaded is a valid B2C Policy file.");
                throw Error;
            }
        })
        return result;
    }

    // Gets the Tenant ID and Policy ID from the Open Document
    static getPolicyInfo(): PolicyInfoObj {
        let editor = window.activeTextEditor;
        var xmldata = "";
        if (editor) {
            let doc = editor.document;
            xmldata = doc.getText();
        }

        try {
            var xmlDoc = new DOMParser().parseFromString(xmldata);
            var Polid = xmlDoc.getElementsByTagName("TrustFrameworkPolicy")[0].getAttribute("PolicyId")
            var tenantID = xmlDoc.getElementsByTagName("TrustFrameworkPolicy")[0].getAttribute("TenantId")
        } catch (error) {
            vscode.window.showErrorMessage("Error retrieveing PolicyId and TenantId from Policy File. Please ensure the file being uploaded is a valid B2C Policy file.");
            throw Error;
        }

        var rtnobj = {
            PolicyId: Polid,
            TenantId: tenantID,
            BasePolicyId: ""
        };

        return rtnobj;
    }


    static getB2CAPIClientID() {
        var config = vscode.workspace.getConfiguration('aadb2c.graph');

        var RtnVal = config.has("clientid");
        if (!RtnVal) {
            vscode.window.showErrorMessage("The ClientId setting is not set");
            return "";
        }
        return "" + config.get("clientid");
    }

    static async uploadpolicy(tokenResponse: adal.TokenResponse, PolicyId: string) {
        var at = tokenResponse.accessToken;
        var bearertoken = "Bearer " + at;

        console.log(" upload policy");

        var docContent = "";
        let editor = window.activeTextEditor;
        if (editor) {
            let doc = editor.document;
            docContent = doc.getText();
        }

        var options2 = {
            method: "PUT",
            url: Consts.B2CGraphEndpoint + "/" + PolicyId + "/$value",
            headers: {
                "Authorization": bearertoken,
                "Content-Type": "application/xml"
            }
        };

        var request = require('request');
        function callback(this: B2CUtils, error, response, body) {
            if (!error && response.statusCode == 200) {
                console.error("Upload success.")
                vscode.window.showInformationMessage("Upload success")
            }
            else {
                var rspbody = response.body;
                var errmsg = JSON.parse(rspbody).error.message;
                console.error("Upload failed: " + errmsg)
                vscode.window.showErrorMessage(errmsg);
            }
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Policy (" + PolicyId + ")...",
            cancellable: false
        },
            async (progress) => {
                await request(options2, callback.bind(this)).write(docContent)
            });
    }
}