// Adding ADAL for Policy Upload
import * as adal from 'adal-node';
import { window } from 'vscode';
import * as vscode from 'vscode';
import Consts from './Consts';
import { AuthenticationContext } from 'adal-node';
import Config from './config';
import * as fs from 'fs';
import * as async from 'async';

var xpath = require('xpath');
var DOMParser = require('xmldom').DOMParser;

interface IPolicy {
    policyInfo: PolicyInfoObj,
    xmlData: string,
    queued: boolean
}

interface PolicyInfoObj {
    PolicyId: string,
    BasePolicyId: string,
    TenantId: string;
}

export default class PolicyUpload {

    private static policyUploadQueue;

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
        let clientID = PolicyUpload.getMSGraphClientID();
        let authURL = Consts.ADALauthURLPrefix + tenantId;
        let authcontext = new adal.AuthenticationContext(authURL);

        return new Promise((resolve, reject) => {
            authcontext.acquireToken(Consts.ADALresource, "", clientID, function (err, tokenResponse) {
                //reauthenticate if the access token is invalid
                if (err) {
                    PolicyUpload.devcodelogin(tenantId, clientID)
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

    static uploadCurrentPolicy() {
        var PolicyInfo = PolicyUpload.getPolicyInfo();

        this.acquireToken(PolicyInfo.TenantId).then(tokenResponse =>
            PolicyUpload.uploadPolicy(tokenResponse as adal.TokenResponse, PolicyInfo.PolicyId));
    }

    static async uploadAllPolicies() {
        const targetEnvironment = Config.GetDefaultEnvironment();

        //default path to policies is the working folder
        let policiesPath = vscode.workspace.rootPath as string;
        if (targetEnvironment) {
            //adding envionment path if default environment name is set in the extension's settings
            policiesPath += `/Environments/${targetEnvironment}`;
        }

        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(policiesPath, '*.{xml}'));

        //load all policies in memory
        const policies = this.loadPolicies(files);

        if (!policies || policies.size == 0) {
            vscode.window.showErrorMessage(`No B2C policies found in ${targetEnvironment}`);
            return;
        }

        let tenantId = targetEnvironment ?
            //get tenant id from the environment configuration
            (await Config.GetEnvironment(targetEnvironment)).Tenant :
            //get tenant id from the 1st policy in the list
            policies.values().next().value.policyInfo.TenantId;
        if (!tenantId) {
            vscode.window.showErrorMessage("Cannot identify the B2C Tenant Id");
            return;
        }

        //get the access token
        const tokenResponse = await this.acquireToken(tenantId);

        //upload policies recursively
        this.policyUploadQueue = [];
        for (const policy of policies) {
            await this.queuePolicyForUpload(tokenResponse.accessToken, policy[1], policies);
        }
        PolicyUpload.processPolicyUploadQueue();
    }

    static processPolicyUploadQueue() {
        if (this.policyUploadQueue.length > 0) {
            async.series(this.policyUploadQueue, (err) => {
                if (err) {
                    vscode.window.showErrorMessage(`An error has occurred during the policies upload: ${err}`);
                    return;
                }
                vscode.window.showInformationMessage(`${this.policyUploadQueue.length} policies have been successfully uploaded`);
            })
        }
        else {
            vscode.window.showErrorMessage('The policies upload queue is empty');
        }
    }

    static async queuePolicyForUpload(token: string, policy: IPolicy, policies: Map<string, IPolicy>) {
        if (policy.queued) {
            return;
        }

        //upload base policy first
        if (policy.policyInfo.BasePolicyId) {
            let basePolicy = policies.get(policy.policyInfo.BasePolicyId);
            if (basePolicy && !basePolicy.queued) {
                await this.queuePolicyForUpload(token, basePolicy, policies);
            }
        }

        const options = {
            method: "PUT",
            url: Consts.B2CGraphEndpoint + "/" + policy.policyInfo.PolicyId + "/$value",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/xml"
            }
        };

        this.policyUploadQueue.push(async (cb) => {
            const request = require('request');
            let promise = new Promise((resolve, reject) => {
                try {
                    request(options, (error, response) => {
                        if (!error && response.statusCode == 200) {
                            resolve(response);
                            cb(null, response);
                            vscode.window.showInformationMessage(`${policy.policyInfo.PolicyId} policy uploaded successfully`)
                        }
                        else {
                            if (!error) {
                                error = JSON.parse(response.body).error.message;
                            }
                            reject(error);
                            cb(error);
                            vscode.window.showErrorMessage(`${policy.policyInfo.PolicyId} policy upload failed: ${error}`)
                        }
                    }).write(policy.xmlData);
                }
                catch (error) {
                    vscode.window.showErrorMessage(error);
                    reject(error);
                    cb(error);
                }
            });
            await promise;
        });
        policy.queued = true;

    }

    static uploadCallback(error, response) {
        if (!error && response.statusCode == 200) {
            console.error("Upload success.")
            vscode.window.showInformationMessage("Upload success");
        }
        else {
            const rspbody = response.body;
            const errmsg = JSON.parse(rspbody).error.message;
            console.error("Upload failed: " + errmsg)
            vscode.window.showErrorMessage(errmsg);
        }
    }

    static loadPolicies(files: vscode.Uri[]): Map<string, IPolicy> {
        var result = new Map<string, IPolicy>();
        files.forEach(file => {
            try {
                const xmlData = fs.readFileSync(file.fsPath).toString();
                const xmlDoc = new DOMParser().parseFromString(xmlData);
                const selector = xpath.useNamespaces({ "ns": "http://schemas.microsoft.com/online/cpim/schemas/2013/06" });

                //skip the file if policy id or tenant id are not found
                if ((selector("./ns:TrustFrameworkPolicy/@PolicyId", xmlDoc).length == 0)
                    || selector("./ns:TrustFrameworkPolicy/@TenantId", xmlDoc).length == 0) {
                    return;
                }

                const policyId = selector("./ns:TrustFrameworkPolicy/@PolicyId", xmlDoc)[0].nodeValue;
                const tenantId = selector("./ns:TrustFrameworkPolicy/@TenantId", xmlDoc)[0].nodeValue;
                let basePolicyId = "";
                if (selector("./ns:TrustFrameworkPolicy/ns:BasePolicy", xmlDoc).length > 0) {
                    basePolicyId = selector("./ns:TrustFrameworkPolicy/ns:BasePolicy/ns:PolicyId", xmlDoc)[0].textContent;
                }

                result.set(policyId, {
                    policyInfo: {
                        TenantId: tenantId,
                        PolicyId: policyId,
                        BasePolicyId: basePolicyId
                    },
                    xmlData: xmlData,
                    queued: false
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


    static getMSGraphClientID() {
        var config = vscode.workspace.getConfiguration('aadb2c.graph');

        var RtnVal = config.has("clientid");
        if (!RtnVal) {
            vscode.window.showErrorMessage("The ClientId setting is not set");
            return "";
        }
        return "" + config.get("clientid");
    }

    static async uploadPolicy(tokenResponse: adal.TokenResponse, PolicyId: string) {
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

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Policy (" + PolicyId + ")...",
            cancellable: false
        },
            async (progress) => {
                await request(options2, uploadCallback.bind(this)).write(docContent)
            });

        function uploadCallback(error, response) {
            if (!error && response.statusCode == 200) {
                console.info("Policy " + PolicyId + " successfully uploaded.")
                vscode.window.showInformationMessage("Policy '" + PolicyId + "' uploaded.");
            }
            else {
                const rspbody = response.body;
                const errmsg = JSON.parse(rspbody).error.message;
                console.error("Upload failed: " + errmsg)
                vscode.window.showErrorMessage(errmsg);
            }
        }
    }
}