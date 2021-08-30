import * as vscode from 'vscode';
import PolicyBuild from './PolicyBuild';
import XmlHelper from './services/XmlHelper';
import XsdHelper from './services/XsdHelper';
import { Suggestion } from './models/Suggestion';
import { SelectedWord } from './models/SelectedWord';
import Consts from './Consts';

export default class CompletionProvider implements vscode.CompletionItemProvider {

    xmlExtensionInstalledAndActive: boolean = false;

    provideCompletionItems(document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {

        let xmlExtensions: string[] = ['redhat.vscode-xml', 'dotjoshjohnson.xml'];

        xmlExtensions.forEach(element => {
            // Check if an XML extensions is installed and activated
            if (this.xmlExtensionInstalledAndActive == false) {
                let xmlExtension = vscode.extensions.getExtension(element);

                this.xmlExtensionInstalledAndActive = (xmlExtension && xmlExtension.isActive) ? true : false;
            }
        });

        return this.GetItems(document, position);

    }

    async GetItems(document: vscode.TextDocument, position: vscode.Position) {
        let linePrefix = document.lineAt(position).text.substr(0, position.character);

        if (XmlHelper.IsCurlyBrackets(document, position)) {

            let list: string[] = PolicyBuild.GetAllSettings();

            // Sort the array
            list.sort();

            let completionItems: vscode.CompletionItem[] = [];

            list.forEach(function (value) {
                completionItems.push(new vscode.CompletionItem(value.substr(1), vscode.CompletionItemKind.Field));
            });

            return completionItems;
        }
        // Check whether the user is closing an open xml element, by typing the > character.
        // If yes suggest the closing xml element
        else if (!this.xmlExtensionInstalledAndActive && (XmlHelper.IsEndOfElement(document, position) || XmlHelper.IsStartOfClosingElement(document, position))) {
            let xPath = XmlHelper.GetXPath(document, position);

            if (xPath.length >= 1) {
                let completionItems: vscode.CompletionItem[] = [];
                let suggestion = new vscode.CompletionItem('/' + xPath[xPath.length - 1], vscode.CompletionItemKind.Field);
                suggestion.insertText = XmlHelper.IsStartOfClosingElement(document, position) ? xPath[xPath.length - 1] + '>' : '</' + xPath[xPath.length - 1] + '>';

                completionItems.push(suggestion);

                // Get the element body suggestion
                let attributeName = XmlHelper.GetCloseAttributeName(document, position)
                let values: Suggestion[] = XsdHelper.GetAttributeValues(xPath, attributeName);

                if (values && values.length > 0) {
                    values.sort();

                    // Add the attribute' values
                    values.forEach(function (value) {

                        let suggestion = new vscode.CompletionItem(value.InsertText, vscode.CompletionItemKind.Field);
                        completionItems.push(suggestion);
                    });
                }
                return completionItems;
            }
        }

        // Check whether the user is opening new xml element, by typing < or </.
        // If yes suggest the list of children and closing xml element 
        else if ((!this.xmlExtensionInstalledAndActive && XmlHelper.IsStartOfOpeningElement(document, position))) {
            let xPath = XmlHelper.GetXPath(document, position);
            let elements: Suggestion[] = XsdHelper.GetSubElements(xPath);

            if (!elements || elements.length < 1) return;

            // elements.sort();

            let completionItems: vscode.CompletionItem[] = [];
            let closeTo: boolean = XmlHelper.IsNodeClosed(document, position);

            // Add a closing element (e.g. </element>)
            if (xPath.length >= 1)
                completionItems.push(new vscode.CompletionItem('/' + xPath[xPath.length - 1], vscode.CompletionItemKind.Field));

            // Add the element's children
            elements.forEach(function (value) {

                let suggestion = new vscode.CompletionItem(value.InsertText, vscode.CompletionItemKind.Field);

                // Add closing node only if there is white space after the typed word
                if (closeTo) {
                    if (value.HasChildren)
                        // Add an element with children
                        suggestion.additionalTextEdits = [vscode.TextEdit.insert(new vscode.Position(position.line, position.character + value.InsertText.length + 1), '\n' + " ".repeat(position.character) + '  \n' + " ".repeat(position.character - 1) + '</' + value.InsertText + '>')];
                    else if (value.HasContent)
                        // Add an element with text content, such as display name or protocol
                        suggestion.additionalTextEdits = [vscode.TextEdit.insert(new vscode.Position(position.line, position.character + value.InsertText.length + 1), '</' + value.InsertText + '>')];
                    else
                        // Add an element without content, such as output claim
                        suggestion.insertText = suggestion.label + " /";
                }

                if (value.Help)
                    suggestion.detail = value.Help;


                completionItems.push(suggestion);
            });

            return completionItems;
        }
        // Check whether the user is typing a space within an xml element (by typing space ' ').
        // If yes, get the list of attribute for the selected xml element 
        else if (XmlHelper.IsStartOfAttribute(document, position)) {
            let xPath = XmlHelper.GetXPath(document, position);
            let attributes: Suggestion[] = XsdHelper.GetAttributes(xPath);

            if (!attributes || attributes.length < 1) return;

            attributes.sort();

            let completionItems: vscode.CompletionItem[] = [];

            // Add the element's children
            attributes.forEach(function (value) {

                let suggestion = new vscode.CompletionItem(value.InsertText, vscode.CompletionItemKind.Field);

                if (value.Help)
                    suggestion.detail = value.Help;

                completionItems.push(suggestion);
            });

            return completionItems;
        }
        // Check whether the user wants to add attribute value
        // If yes, get the list of values for the selected attribute 
        else if (XmlHelper.IsStartOfAttributeValue(document, position)) {

            let startsWithCurlyBrackets: boolean = linePrefix.endsWith('{');

            let list: string[] = [];
            let addSettings: boolean = true;

            if (XmlHelper.IsCloseToAttribute("DefaultValue", linePrefix, position)) {
                // Add the claim resolvers
                list = ['{Culture:LanguageName}', '{Culture:LCID}', '{Culture:RegionName}', '{Culture:RFC5646}',
                    '{Policy:PolicyId}', '{Policy:RelyingPartyTenantId}', '{Policy:TenantObjectId}',
                    '{Policy:TrustFrameworkTenantId}', '{OIDC:AuthenticationContextReferences}', '{OIDC:ClientId}',
                    '{OIDC:DomainHint}', '{OIDC:LoginHint}', '{OIDC:MaxAge}', '{OIDC:Nonce}', '{OIDC:Password}',
                    '{OIDC:Username}', '{OIDC:Prompt}', '{OIDC:RedirectUri}', '{OIDC:Resource}',
                    '{OIDC:scope}', '{Context:BuildNumber}', '{Context:CorrelationId}', '{Context:DateTimeInUtc}',
                    '{Context:DeploymentMode}', '{Context:HostName}', '{Context:KMSI}', '{Claim:replace-to-your-claim-type}',
                    '{Context:IPAddress}', '{OAUTH-KV:campaignId}', '{OAUTH-KV:replace-with-your-key}', '{oauth2:access_token}',
                    '{oauth2:refresh_token}',
                    '{SAML:AuthnContextClassReferences}', '{SAML:NameIdPolicyFormat}', '{SAML:Issuer}', '{SAML:AllowCreate}',
                    '{SAML:ForceAuthn}', '{SAML:ProviderName}', '{SAML:RelayState}', '{SAML:Subject}'];
            }
            // Get claims list
            else if (XmlHelper.IsCloseToAttribute("ClaimTypeReferenceId", linePrefix, position)) {
                addSettings = false;
                list = await XmlHelper.GetXmlFilesWithCurrentFile(document).then((files) => {
                    return list.concat(XmlHelper.GetElementIDsByNodeName('ClaimType', files));
                }).then(items => { return items });
            }
            else if (XmlHelper.IsInNodeAndCloseToAttribute("Item", "Key", linePrefix, position)) {

                // Get the selected word
                var selectedWord: SelectedWord = new SelectedWord();

                // Get more information regarding the selected word	
                selectedWord = XmlHelper.GetSelectedWordData(selectedWord, position, document);
                let completionItems: vscode.CompletionItem[] = [];
                let items = Consts.TP_Metadata.filter(item => item.Protocol === selectedWord.GetSelectedGrandParentElement().ElementType)

                items.sort((a, b) => a.Key.localeCompare(b.Key))
                    .forEach(function (value) {
                        completionItems.push(new vscode.CompletionItem(value.Key, vscode.CompletionItemKind.Field));
                    }
                    );

                return completionItems;
            }
            // Get the list of technical profiles
            else if (XmlHelper.IsCloseToAttribute("TechnicalProfileReferenceId", linePrefix, position) ||
                XmlHelper.IsInNodeAndCloseToAttribute("TechnicalProfile", "Id", linePrefix, position) ||
                XmlHelper.IsInNodeAndCloseToAttribute("ValidationTechnicalProfile", "ReferenceId", linePrefix, position) ||
                XmlHelper.IsInNodeAndCloseToAttribute("IncludeTechnicalProfile", "ReferenceId", linePrefix, position) ||
                XmlHelper.IsInNodeAndCloseToAttribute("UseTechnicalProfileForSessionManagement", "ReferenceId", linePrefix, position)) {
                addSettings = false;
                list = await XmlHelper.GetXmlFilesWithCurrentFile(document).then((files) => {
                    return list.concat(XmlHelper.GetElementIDsByNodeName('TechnicalProfile', files));
                }).then(items => { return items });
            }

            // Get the list of claims transformation
            else if (XmlHelper.IsInNodeAndCloseToAttribute("InputClaimsTransformation", "ReferenceId", linePrefix, position) ||
                XmlHelper.IsInNodeAndCloseToAttribute("OutputClaimsTransformation", "ReferenceId", linePrefix, position)) {
                addSettings = false;
                list = await XmlHelper.GetXmlFilesWithCurrentFile(document).then((files) => {
                    return list.concat(XmlHelper.GetElementIDsByNodeName('ClaimsTransformation', files));
                }).then(items => { return items });
            }
            // Get the list of content definitions
            else if (XmlHelper.IsInNodeAndCloseToAttribute("ContentDefinition", "ContentDefinitionReferenceId", linePrefix, position)) {
                addSettings = false;
                list = await XmlHelper.GetXmlFilesWithCurrentFile(document).then((files) => {
                    return list.concat(XmlHelper.GetElementIDsByNodeName('ContentDefinition', files));
                }).then(items => { return items });
            }
            // Get the list of claims exchange
            else if (XmlHelper.IsInNodeAndCloseToAttribute("ClaimsExchange", "TargetClaimsExchangeId", linePrefix, position) ||
                XmlHelper.IsInNodeAndCloseToAttribute("ClaimsExchange", "ValidationClaimsExchangeId", linePrefix, position)) {
                addSettings = false;
                list = await XmlHelper.GetXmlFilesWithCurrentFile(document).then((files) => {
                    return list.concat(XmlHelper.GetElementIDsByNodeName('ClaimsExchange', files));
                }).then(items => { return items });
            }
            else {
                let xPath = XmlHelper.GetXPath(document, position);
                let attributeName = XmlHelper.GetCloseAttributeName(document, position)
                let values: Suggestion[] = XsdHelper.GetAttributeValues(xPath, attributeName);

                if (!values || values.length < 1) return;

                values.sort();

                let completionItems: vscode.CompletionItem[] = [];

                // Add the attribute' values
                values.forEach(function (value) {

                    let suggestion = new vscode.CompletionItem(value.InsertText, vscode.CompletionItemKind.Field);
                    completionItems.push(suggestion);
                });

                return completionItems;
            }

            // Add the app settings keys
            if (addSettings) {
                list = list.concat(PolicyBuild.GetAllSettings());
            }

            // Sort the array
            list.sort();

            let completionItems: vscode.CompletionItem[] = [];

            list.forEach(function (value) {
                completionItems.push(new vscode.CompletionItem(startsWithCurlyBrackets ? value.substr(1) : value, vscode.CompletionItemKind.Field));
            });

            return completionItems;
        }
    }

}