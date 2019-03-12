import SnippetProvider from "./SnippetProvider";
import Consts from './Consts';
import * as vscode from 'vscode';
const DOMParser = require('xmldom').DOMParser;


export default class InsertCommands {
    static InsertClaimType() {
        let UserInputTypeList = ['TextBox', 'Radio Single Select', 'Dropdown Single Select', 'Checkbox Multi Select', 'DateTime Dropdown', 'Read only', 'Paragraph', 'Boolean', 'Integer', 'Long', 'String', 'String collection'];
        let name: string | undefined = 'Default';
        let displayName: string | undefined = 'Default';
        let userInputType: string | undefined = 'none';


        vscode.window.showQuickPick(UserInputTypeList, { placeHolder: 'Select user input type' })
            .then(result => {
                if (!result)
                    return Promise.reject('user cancelled');

                userInputType = result
            }).then(() => {
                return vscode.window.showInputBox({ prompt: "Provide a name" })
                    .then(result => {
                        if (!result)
                            return Promise.reject('user cancelled');

                        name = result;
                    });
            })
            .then(() => {
                return vscode.window.showInputBox({ prompt: "Provide a dispaly name that describe the claim type" })
                    .then(result => {
                        if (!result)
                            return Promise.reject('user cancelled');

                        displayName = result;
                    });
            })
            .then(() => {
                switch (userInputType) {
                    case "TextBox": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_TextBox, name, displayName));
                    case "Radio Single Select": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_RadioSingleSelect, name, displayName));
                    case "Dropdown Single Select": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_DropdownSingleSelect, name, displayName));
                    case "Checkbox Multi Select": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_CheckboxMultiSelect, name, displayName));
                    case "DateTime Dropdown": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_DateTimeDropdown, name, displayName));
                    case "Read only": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_Readonly, name, displayName));
                    case "Paragraph": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_Paragraph, name, displayName));
                    case "Boolean": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_Boolean, name, displayName));
                    case "Integer": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_Integer, name, displayName));
                    case "Long": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_Long, name, displayName));
                    case "String": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_String, name, displayName));
                    case "String collection": SnippetProvider.insertText(InsertCommands.GetClaimTypeWithParents(Consts.CLAIM_stringCollection, name, displayName));
                }
            })
            .then(() => {
                return vscode.window.showInformationMessage("For more information, see: [Modify sign up to add new claims and configure user input.](https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-configure-signup-self-asserted-custom). To store a custom attributes in Azure AD directory, you need also to change the Claim type name to 'extension_" + name + "' and set the application. For more information, see [Creating and using custom attributes in a custom profile edit policy](https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-create-custom-attributes-profile-edit-custom) ")
            });

    }
    static GetClaimTypeWithParents(xml: string, name, displayName) {

        // Load the current XML document from the active text editor
        if (!vscode.window.activeTextEditor) {
            return xml;
        }
        var xmlDoc = new DOMParser().parseFromString(vscode.window.activeTextEditor.document.getText());

        // Try to find the BuildingBlocks element in the target XML document. If not exists add a new one
        var docLookupList = xmlDoc.getElementsByTagName("BuildingBlocks");
        if (docLookupList.length == 0) {
            xml = '  <BuildingBlocks>\r\n    <ClaimsSchema>\r\n' + xml + '    </ClaimsSchema>\r\n  </BuildingBlocks>\r\n';
        }
        else {
            // Try to find the ClaimsSchema element in the target XML document. If not exists add a new one
            var docLookupList = xmlDoc.getElementsByTagName("ClaimsSchema");
            if (docLookupList.length == 0)
                xml = '    <ClaimsSchema>\r\n' + xml + '    </ClaimsSchema>\r\n';
        }

        return xml.replace(/\|/g, "      ").replace("{name}", name).replace("{displayName}", displayName);
    }

    static InsertTechnicalProfileIdp() {
        let IdentityProviderList = ['Microsoft', 'Facebook', 'Azure AD', 'Azure AD Multi tenant', 'Google+'
            , 'LinkedIn', 'Twitter', 'AD-FS', 'Salesforce', 'Amazon'];
        let idp: string | undefined = 'default';

        vscode.window.showQuickPick(IdentityProviderList.sort(), { placeHolder: 'Select an identity provider' })
            .then(result => {
                idp = result;

                if (!result)
                    return Promise.reject('user cancelled');

                switch (idp) {
                    case "Microsoft": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_Microsoft));
                    case "Facebook": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_Facebook));
                    case "Azure AD": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_AzureAD));
                    case "Azure AD Multi tenant": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_AzueADMulti));
                    case "Google+": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_Google));
                    case "LinkedIn": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_LinkeIn));
                    case "Twitter": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_Twitter));
                    case "AD-FS": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_ADFS));
                    case "Salesforce": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_Saleforce));
                    case "VK": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_VK));
                    case "Amazon": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileIdpWithParents(Consts.TP_IDP_Amazon));
                }
            })
            .then(() => {
                let title: string = '';
                let url: string = '';

                switch (idp) {
                    case "Microsoft": title = 'Add Microsoft Account (MSA) as an identity provider using custom policies'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-custom-setup-msa-idp'; break;
                    case "Facebook": title = ''; url = ''; break;
                    case "Azure AD": title = 'Sign in by using Azure AD accounts'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-setup-aad-custom'; break;
                    case "Azure AD Multi tenant": title = 'Allow users to sign in to a multi-tenant Azure AD identity provider using custom policies'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-setup-commonaad-custom'; break;
                    case "Google+": title = 'Add Google+ as an OAuth2 identity provider using custom policies'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-custom-setup-goog-idp'; break;
                    case "LinkedIn": title = 'Add LinkedIn as an identity provider by using custom policies'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-custom-setup-li-idp'; break;
                    case "Twitter": title = 'Add Twitter as an OAuth1 identity provider by using custom policies'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-custom-setup-twitter-idp'; break;
                    case "AD-FS": title = 'Add ADFS as a SAML identity provider using custom policies'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-custom-setup-adfs2016-idp'; break;
                    case "Salesforce": title = 'Sign in by using Salesforce accounts via SAML'; url = 'https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-setup-sf-app-custom'; break;
                    case "VK": title = ''; url = ''; break;
                    case "Amazon": title = ''; url = ''; break;
                }

                if (title != '')
                    return vscode.window.showInformationMessage("For more information, see: [" + title + "](" + url + ")");
            });

    }

    static GetTechnicalProfileIdpWithParents(xml: string) {

        // Load the current XML document from the active text editor
        if (!vscode.window.activeTextEditor) {
            return xml;
        }
        var xmlDoc = new DOMParser().parseFromString(vscode.window.activeTextEditor.document.getText());

        // Try to find the ClaimsProviders element in the target XML document. If not exists add a new one
        var docLookupList = xmlDoc.getElementsByTagName("ClaimsProviders");
        if (docLookupList.length == 0) {
            xml = '  <ClaimsProviders>\r\n' + xml + '  </ClaimsProviders>\r\n';
        }

        return xml.replace(/\|/g, "    ");
    }
    static InsertTechnicalProfileRESTAPI() {
        let authenticationTypeList = ['None', 'Basic', 'Client Certificate'];
        let name: string | undefined = 'Default';
        let serviceUri: string | undefined = 'https://server-name/api/sign-up';
        let authenticationType: string | undefined = 'none';

        vscode.window.showInputBox({ prompt: "Provide a name" })
            .then(result => {
                if (!result)
                    return Promise.reject('user cancelled');

                name = result;
            })
            .then(() => {
                return vscode.window.showInputBox({ prompt: "Service URL" })
                    .then(result => {
                        if (!result)
                            return Promise.reject('user cancelled');

                        serviceUri = result;
                    });
            })
            .then(() => {
                return vscode.window.showQuickPick(authenticationTypeList, { placeHolder: 'Select Authentication Type' })
                    .then(result => {
                        if (!result)
                            return Promise.reject('user cancelled');

                        authenticationType = result
                    });
            })
            .then(() => {
                switch (authenticationType) {
                    case "None": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileRESTAPIWithParents(Consts.TP_REST_None, name, serviceUri));
                    case "Basic": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileRESTAPIWithParents(Consts.TP_REST_Basic, name, serviceUri));
                    case "Client Certificate": SnippetProvider.insertText(InsertCommands.GetTechnicalProfileRESTAPIWithParents(Consts.TP_REST_ClientCertificate, name, serviceUri));
                }
            })
            .then(() => {
                return vscode.window.showInformationMessage("For more information, see: [Integrate REST API claims exchanges in your Azure AD B2C user journey as validation of user input](https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-custom-rest-api-netfw)")
            });

    }

    static GetTechnicalProfileRESTAPIWithParents(xml: string, name: string | any, serviceUri: string | any) {

        // Load the current XML document from the active text editor
        if (!vscode.window.activeTextEditor) {
            return xml;
        }
        var xmlDoc = new DOMParser().parseFromString(vscode.window.activeTextEditor.document.getText());

        // Check if the custom REST API claims provider already exists
        var RestClaimsProviderExists: boolean = false;
        var docLookupList = xmlDoc.getElementsByTagName("ClaimsProvider");
        for (var i = 0; i < docLookupList.length; i++) {
            var subNode = docLookupList[i].getElementsByTagName("DisplayName");
            if (subNode != null && subNode.length >0 && subNode[0].textContent === 'Custom REST API') {
                RestClaimsProviderExists = true;
                break;
            }
        }

        if (!RestClaimsProviderExists) {
            xml =
                '|<ClaimsProvider>\r\n' +
                '|  <DisplayName>Custom REST API</DisplayName>\r\n' +
                '|  <TechnicalProfiles>\r\n' +
                xml +
                '|  </TechnicalProfiles>\r\n' +
                '|</ClaimsProvider>\r\n';
        }

        // Try to find the ClaimsProviders element in the target XML document. If not exists add a new one
        docLookupList = xmlDoc.getElementsByTagName("ClaimsProviders");
        if (docLookupList.length == 0) {
            xml = '  <ClaimsProviders>\r\n' + xml + '  </ClaimsProviders>\r\n';
        }

        return xml.replace(/\|/g, "    ").replace("{name}", name).replace("{serviceUri}", serviceUri);
    }

    static InsertApplicationInsights() {
        let instrumentationKey: string | undefined = 'Default';


        try {
            var editor: vscode.TextEditor = vscode.window.activeTextEditor as vscode.TextEditor;
            var DOMParser = require('xmldom').DOMParser; //https://www.npmjs.com/package/xmldom
            var xmlDoc = new DOMParser().parseFromString(editor.document.getText(), "application/xml");

            // Check if policy is a relying party
            var xmlRelyingParty = xmlDoc.getElementsByTagName("RelyingParty");
            if (xmlRelyingParty.length == 0) {
                vscode.window.showWarningMessage("Application insights trace can not be added to this policy. You can add Application insights trace only to relying party policy.");
                return;
            }

            vscode.window.showInputBox({ prompt: "Type your instrumentation key" })
                .then(result => {
                    if (!result)
                        return Promise.reject('user cancelled');

                    instrumentationKey = result;
                })
                .then(() => {
                    SnippetProvider.insertText(Consts.ApplicationInsightsDebugMode.replace("{instrumentationKey}", instrumentationKey as string));
                })
                .then(() => {
                    return vscode.window.showInformationMessage("See the commets how to set the policy deployment mode to debug, and user journey recorder endpoint.  " +
                        "For more information, see: [Azure Active Directory B2C: Collecting Logs](https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-troubleshoot-custom)")
                });
        }
        catch (e) {
            console.log(e.message)
        }

    }
}