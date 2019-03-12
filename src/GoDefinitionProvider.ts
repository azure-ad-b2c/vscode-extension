
import * as vscode from 'vscode';
import { ReferenceProvider } from './ReferenceProvider';
import { FileData } from './ReferenceProvider';
import { SelectedWord } from './models/SelectedWord';
import XmlHelper from './services/XmlHelper';
const DOMParser = require('xmldom').DOMParser;

export default class GoDefinitionProvider implements vscode.DefinitionProvider {

	public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken): Thenable<vscode.Definition> {

		return this.provideDefinitionExt(document, position, token, false);
	}

	public provideDefinitionExt(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		showAll: boolean): Thenable<vscode.Definition> {

		// Get the selected word
		var selectedWord: SelectedWord = new SelectedWord();
		selectedWord.Value = ReferenceProvider.getSelectedWord(document, position).toLowerCase();

		if (selectedWord.Value.length == 0)
			return new Promise((resolve) => resolve());

		// Get more information regarding the selected word	
		selectedWord = XmlHelper.GetSelectedWordData(selectedWord, position, document);

		var promise = XmlHelper.GetXmlFilesWithCurrentFile(document).then((files) => {
			return this.processSearch(selectedWord, document, files, position, showAll);
		});

		return promise;
	}

	private processSearch(
		selectedWord: SelectedWord,
		document: vscode.TextDocument,
		files: FileData[],
		position: vscode.Position,
		showAll: boolean): Thenable<vscode.Location[]> {

		// Load the ativated XML file and replace the element Id with id
		var hierarchyFiles: FileData[] = [];

		for (var i = 0; i < files.length; i++) {
			var xmlDoc = new DOMParser().parseFromString(files[i].Data.toLowerCase());
			var trustFrameworkPolicyElement = xmlDoc.getElementsByTagName("TrustFrameworkPolicy".toLowerCase());

			if (trustFrameworkPolicyElement.length == 1) {
				files[i].Policy = trustFrameworkPolicyElement[0].getAttribute("policyid");
			}

			var basePolicyElement = xmlDoc.getElementsByTagName("BasePolicy".toLowerCase());
			if (basePolicyElement.length == 1) {

				var policyid = basePolicyElement[0].getElementsByTagName("policyid");
				if (policyid.length == 1) {

					files[i].ParentPolicy = policyid[0].textContent;
				}
			}
		}
		var locations: vscode.Location[] = [];

		if (!showAll)
			hierarchyFiles = XmlHelper.GetFileHierarchy(files, files[0], hierarchyFiles, 1);
		else
			hierarchyFiles = files;

		// Iterate through files array
		for (const file of hierarchyFiles) {
			var xmlDoc = new DOMParser().parseFromString(file.Data.toLowerCase());

			// Search for TrustFrameworkPolicy with PolicyId equals to the selected word
			if (selectedWord.GetSelectedElement().ElementNodeName == "policyid") {

				var docLookupList = xmlDoc.getElementsByTagName("trustframeworkpolicy");
				if (docLookupList.length == 1 && docLookupList[0].getAttribute("policyid") == selectedWord.Value) {
					var location = new vscode.Location(file.Uri, new vscode.Position(docLookupList[0].lineNumber, docLookupList[0].columnNumber));

					// Return the selected element
					locations.push(location);
					if (!showAll) { return new Promise(resolve => { resolve(locations);; }); }
				}
			}
			// Search for ClaimsProviderSelection we need to search for ClaimsExchange with the same Id within the scope of the UserJourney  
			else if (selectedWord.GetSelectedElement().ElementNodeName == "claimsproviderselection") {

				// The ClaimsExchange is always in the same document
				if (file.Uri != document.uri)
					continue;

				var docLookupList = xmlDoc.getElementsByTagName("userjourney");

				for (var i = 0; i < docLookupList.length; i++) {
					if (docLookupList[i].getAttribute("id") === selectedWord.GetFirstElementWithId().ElementID) {


						var nodeList = docLookupList[i].getElementsByTagName("*");

						for (var i2 = 0; i2 < nodeList.length; i2++) {
							if (nodeList[i2].getAttribute("id") === selectedWord.Value.toLowerCase()) {

								// Return the selected element
								var location = new vscode.Location(file.Uri, new vscode.Position(nodeList[i2].lineNumber, nodeList[i2].columnNumber));
								locations.push(location);
								if (!showAll) { return new Promise(resolve => { resolve(locations);; }); }

								break;
							}
						}

						break;
					}
				}


			}
			// Search for element with such ID
			else {

				var nsAttr = xmlDoc.getElementById(selectedWord.Value.toLowerCase());

				// If element found and it's not the same element the user pointing (same file and same line)
				if (nsAttr != null &&
					!(file.Uri === document.uri && (nsAttr.lineNumber == position.line || nsAttr.lineNumber - 1 == position.line)) &&
					!(showAll && nsAttr.nodeName == "claimsexchange")) // this element has multiple instances under different user journeys 
				{

					var location = new vscode.Location(file.Uri, new vscode.Position(nsAttr.lineNumber, nsAttr.columnNumber));

					// Return the selected element
					locations.push(location);
					if (!showAll) { return new Promise(resolve => { resolve(locations);; }); }
				}
			}
		}

		if (showAll) {
			return new Promise(resolve => {
				resolve(locations);;
			});
		}

		// Return no found (null)
		return new Promise((resolve) => resolve());
	}
}

