import * as vscode from 'vscode';
const clipboardy = require('clipboardy');
const DOMParser = require('xmldom').DOMParser;
export default class SmartCopy {
    static Copy() {

        let editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage("Can't copy Azure AD B2C element, because no document is open.");
            return;
        }

        // Get the selection range
        let selection = editor.selection;
        let range = new vscode.Range(selection.start, selection.end);

        // Load the current XML document from the active text editor
        var xmlDoc = new DOMParser().parseFromString(editor.document.getText());

        var nodeList = xmlDoc.getElementsByTagName("*");

        for (var i = 0; i < nodeList.length; i++) {
            var node = nodeList[i];

            // Try to find the element in the same line.
            // TBD: check the column as well
            if (node.lineNumber == (range.start.line + 1)) {

                let nodeToBeAdded = node;
                let nodeListToBeAdded: any[] = [];

                // Add the element with its parents elements, up to the root element
                while (nodeToBeAdded) {
                    nodeListToBeAdded.push(nodeToBeAdded);
                    nodeToBeAdded = nodeToBeAdded.parentNode;

                    // Don't add the Azure AD B2C root element
                    if (nodeToBeAdded.nodeName === "TrustFrameworkPolicy")
                        break;
                }

                // Change the oreder of the new XML from top to bottom
                nodeListToBeAdded.reverse();

                // Create new empty XML document
                var docToBeAdded = new DOMParser().parseFromString("<TrustFrameworkPolicy />");

                // Iterate through the elements and add them in a parent child hierarchy   
                var rootElement = docToBeAdded.documentElement;
                for (var iNode = 0; iNode < nodeListToBeAdded.length; iNode++) {

                    if (iNode == (nodeListToBeAdded.length - 1)) {

                        // Add the last element with its children 
                        var newElement = docToBeAdded.importNode(nodeListToBeAdded[iNode], true);
                        rootElement = SmartCopy.AddXmlElement(docToBeAdded, rootElement, newElement, iNode);
                    }
                    else {

                        // Add the element to the new XML document
                        var newElement = docToBeAdded.createElement(nodeListToBeAdded[iNode].nodeName);

                        // Add the element's attributes
                        for (var iAtt = 0; iAtt < nodeListToBeAdded[iNode].attributes.length; iAtt++) {
                            newElement.setAttribute(
                                nodeListToBeAdded[iNode].attributes[iAtt].nodeName,
                                nodeListToBeAdded[iNode].attributes[iAtt].nodeValue);
                        }

                        // For ClaimsProvider, add the dispaly name element
                        if (nodeListToBeAdded[iNode].nodeName === "ClaimsProvider" && nodeListToBeAdded[iNode].getElementsByTagName("DisplayName").length >= 1) {
                            for (var iDisplayNameElement = 0; iDisplayNameElement < nodeListToBeAdded[iNode].childNodes.length; iDisplayNameElement++) {

                                // Find the DisplayName child node
                                if (nodeListToBeAdded[iNode].childNodes[iDisplayNameElement].nodeName == "DisplayName") {
                                    var displayNameElementToBeAdded = docToBeAdded.createElement("DisplayName");
                                    displayNameElementToBeAdded.textContent = nodeListToBeAdded[iNode].childNodes[iDisplayNameElement].textContent

                                    // Add the DisplayName element
                                    var ident: string = "  ";
                                    var newLineStr: string = "\n" + ident.repeat(iNode);
                                    var textNode1 = docToBeAdded.createTextNode(newLineStr + ident);

                                    newElement.appendChild(textNode1);
                                    newElement.appendChild(displayNameElementToBeAdded);

                                    break;
                                }
                            }
                        }

                        // Add the node to the new XML document 
                        rootElement = SmartCopy.AddXmlElement(docToBeAdded, rootElement, newElement, iNode);

                    }
                }

                // Get the output XML string
                var xmlString: string = docToBeAdded.documentElement.childNodes[1].toString();

                // Remove the namespace from the imported last XML element
                xmlString = xmlString.replace(' xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06"', '');

                // Copy the new formatted XML document to the clipboard 
                clipboardy.writeSync(xmlString);
                break;
            }
        }
    }

    static AddXmlElement(xmlDoc, parentNode, newNode, newNodeIndex) {
        var ident: string = "  ";
        var newLineStr: string = "\n" + ident.repeat(newNodeIndex);
        var textNode1 = xmlDoc.createTextNode(newLineStr);
        var textNode2 = xmlDoc.createTextNode(newLineStr);
        parentNode.appendChild(textNode1);
        var newRootElement = parentNode.appendChild(newNode);
        parentNode.appendChild(textNode2);
        return newRootElement;
    }

    static Paste() {
        const errorMessage = "Can't paste Azure AD B2C element, because no document is open.";
        let editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage(errorMessage);
            return;
        }

        // Load the current XML document from the active text editor
        var xmlDoc = new DOMParser().parseFromString(editor.document.getText());

        // Try to load the data from the clipboard
        var clipboardXmlDoc;
        try {

            clipboardXmlDoc = new DOMParser().parseFromString(clipboardy.readSync());
        }
        catch (e) {
            vscode.window.showWarningMessage("The clipboard data is not in XML format or dosn't contain any Azure AD B2C element");
            return;
        }

        // Check the XML data is valid
        if ((!clipboardXmlDoc) || clipboardXmlDoc.getElementsByTagName("*").length <= 1) {
            vscode.window.showWarningMessage("The clipboard data is not in XML format or dosn't contain any Azure AD B2C element");
            return;
        }

        // Remove the fist level element
        clipboardXmlDoc = SmartCopy.FindXmlElement(xmlDoc, clipboardXmlDoc);

        // Remove the second level element
        clipboardXmlDoc = SmartCopy.FindXmlElement(xmlDoc, clipboardXmlDoc);

        // Add the clippoard XML to the selected targer document
        let selection = editor.selection;

        let range = new vscode.Range(selection.start, selection.end);

        editor.edit((editBuilder) => {
            editBuilder.replace(range, clipboardXmlDoc.toString());
        });
    }

    static FindXmlElement(xmlDoc, clipboardXmlDoc) {

        var currentElement;

        // Try to get the root element
        for (var i = 0; i < clipboardXmlDoc.childNodes.length; i++) {
            if (clipboardXmlDoc.childNodes[i].nodeName != "#text") {
                currentElement = clipboardXmlDoc.childNodes[i];
                break;
            }
        }

        // Check whether the root element exists
        if (!currentElement)
            return clipboardXmlDoc;

        // Try to find similar element in the target XML document
        var docLookupList = xmlDoc.getElementsByTagName(currentElement.nodeName);
        if (docLookupList.length > 0) {

            var lineBreak: string = '';

            // Find similar node by display name (child node)
            if (currentElement.nodeName === "ClaimsProvider") {
                // If found, check if the node is claims proivder. If yes, compare the display name

                var clipboardDisplayName = SmartCopy.GetChildValueByTagName(currentElement, "DisplayName");
                for (var iCP = 0; iCP < docLookupList.length; iCP++) {
                    var currentElementDisplayName = SmartCopy.GetChildValueByTagName(docLookupList[iCP], "DisplayName");

                    // If an cliams provider with the same display name found, the element can be removed along side the TechnicalProfiles node
                    if (clipboardDisplayName && clipboardDisplayName === currentElementDisplayName) {

                        var newXML: string = '';
                        var allTechnicalProfiles = currentElement.getElementsByTagName("TechnicalProfile");

                        for (var iTP = 0; iTP < allTechnicalProfiles.length; iTP++) {
                            newXML += allTechnicalProfiles[iTP].toString();
                        }

                        return new DOMParser().parseFromString(newXML);
                    }
                }
            }
            // Find similar node by Id (same node)
            else if (currentElement.hasAttribute("Id")) {
                // If found, check if the node is claims proivder. If yes, compare the ID
                for (var i = 0; i < docLookupList.length; i++) {
                    if (docLookupList[i].getAttribute("Id") === currentElement.getAttribute("Id")) {
                        return new DOMParser().parseFromString(currentElement.toString());
                    }
                }
            }
            // Find a unique element, such as BuildingBlocks, ClaimsProviders and ClaimsSchema that can appear once per XML document
            else {
                // If found, remove that element from the clipboard Xml document
                for (var i = 0; i < currentElement.childNodes.length; i++) {
                    if (currentElement.childNodes[i].nodeName != "#text") {
                        return new DOMParser().parseFromString(lineBreak + currentElement.childNodes[i].toString());
                    }
                    else
                        lineBreak = currentElement.childNodes[i].toString()
                }
            }
        }

        // Otherwise return the same clipboard XML document
        return clipboardXmlDoc;
    }

    static GetChildValueByTagName(xmlNode, nodeName) {
        for (var i = 0; i < xmlNode.childNodes.length; i++) {
            if (xmlNode.childNodes[i].nodeName === nodeName) {
                return xmlNode.childNodes[i].textContent;
            }
        }
    }
}